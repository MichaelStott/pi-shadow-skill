import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { simpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import { loadShadowConfig, getRepoConfig, ShadowConfigError, type ShadowConfig, type ShadowRepoConfig } from '../src/config';

// Store config in session-scoped state
let currentRepoConfig: ShadowRepoConfig | null = null;

type GitRemote = {
  name: string;
  refs: {
    fetch?: string;
  };
};

type GitClient = {
  getConfig: (key: string) => Promise<{ value?: string }>;
  getRemotes: (verbose: boolean) => Promise<GitRemote[]>;
};

type GitClientFactory = () => GitClient;

export async function getGitUrl(
  gitClientFactory: GitClientFactory = () => simpleGit() as unknown as GitClient
): Promise<string | null> {
  try {
    const git = gitClientFactory();
    let gitUrlResult = await git.getConfig('remote.origin.url');
    if (gitUrlResult.value) {
      return gitUrlResult.value;
    }

    // Try upstream as fallback
    const remotes = await git.getRemotes(true);
    const upstream = remotes.find(r => r.name === 'upstream');
    if (upstream?.refs.fetch) {
      return upstream.refs.fetch;
    }
  } catch {
    // git not available or not a repo
  }
  return null;
}

export async function loadReadmeContents(
  readmePaths: string[],
  readFile: (path: string, encoding: BufferEncoding) => Promise<string> = fs.readFile
): Promise<{ contents: string[]; errors: Array<{ path: string; message: string }> }> {
  const contents: string[] = [];
  const errors: Array<{ path: string; message: string }> = [];

  for (const readmePath of readmePaths) {
    try {
      const content = await readFile(readmePath, 'utf-8');
      contents.push(content);
    } catch (error) {
      errors.push({ path: readmePath, message: (error as Error).message });
    }
  }

  return { contents, errors };
}

export function buildLoadMessage(repoConfig: ShadowRepoConfig): string {
  const skillCount = (repoConfig.skills || []).length;
  const readmeCount = (repoConfig.readme || []).length;
  return `🌑 - Shadow config loaded: ${skillCount} skill(s), ${readmeCount} readme(s)`;
}

export function createBeforeAgentStartResult(
  systemPrompt: string,
  readmeContents: string[]
): { systemPrompt: string } | undefined {
  if (readmeContents.length === 0) {
    return undefined;
  }

  const injectedContent = readmeContents.join("\n\n---\n\n");
  return {
    systemPrompt: `${systemPrompt}\n\n## Shadow Context Files\n\n${injectedContent}`,
  };
}

type ResolveRepoConfigDeps = {
  currentRepoConfig: ShadowRepoConfig | null;
  getGitUrlFn?: () => Promise<string | null>;
  loadShadowConfigFn?: () => Promise<ShadowConfig>;
  getRepoConfigFn?: (config: ShadowConfig, gitUrl: string) => ShadowRepoConfig | null;
};

export async function resolveRepoConfig({
  currentRepoConfig: existingRepoConfig,
  getGitUrlFn = getGitUrl,
  loadShadowConfigFn = loadShadowConfig,
  getRepoConfigFn = getRepoConfig,
}: ResolveRepoConfigDeps): Promise<ShadowRepoConfig | null> {
  if (existingRepoConfig) {
    return existingRepoConfig;
  }

  const gitUrl = await getGitUrlFn();
  if (!gitUrl) {
    return null;
  }

  const shadowConfig = await loadShadowConfigFn();
  return getRepoConfigFn(shadowConfig, gitUrl);
}

export default function(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const gitUrl = await getGitUrl();
      if (!gitUrl) {
        ctx.ui.notify("🌑 - No git detected. Shadow file loading skipped", "warning");
        return;
      }

      const shadowConfig = await loadShadowConfig();
      currentRepoConfig = getRepoConfig(shadowConfig, gitUrl);

      if (!currentRepoConfig) {
        ctx.ui.notify("🌑 - No shadow files found for " + gitUrl, "warning");
        return;
      }

      ctx.ui.notify(buildLoadMessage(currentRepoConfig), "info");
    } catch (error) {
      if (error instanceof ShadowConfigError) {
        ctx.ui.notify(`🌑 - ${error.message}`, "warning");
      }
    }
  });

  pi.on("before_agent_start", async (event, ctx) => {
    try {
      // Config should already be loaded from session_start, but ensure it's available
      currentRepoConfig = await resolveRepoConfig({ currentRepoConfig });
      if (!currentRepoConfig) {
        return;
      }

      // Load external AGENTS.md files from readme paths
      const readmePaths: string[] = currentRepoConfig.readme || [];
      const { contents: readmeContents, errors } = await loadReadmeContents(readmePaths);
      for (const error of errors) {
        ctx.ui.notify(`🌑 - Failed to load ${error.path}: ${error.message}`, "warning");
      }

      // Load skills from skill paths
      // Inject skills into system prompt (pi will also discover them via resources_discover)
      // Skills are primarily loaded via skillPaths return value in resources_discover

      // Inject readme/AGENTS.md content into system prompt
      const injection = createBeforeAgentStartResult(event.systemPrompt, readmeContents);
      if (injection) {
        return injection;
      }
    } catch (error) {
      if (error instanceof ShadowConfigError) {
        ctx.ui.notify(`🌑 - ${error.message}`, "warning");
      }
    }
  });

  // Discover skills from config
  pi.on("resources_discover", async (_event, _ctx) => {
    if (!currentRepoConfig) {
      return;
    }

    const skillPaths: string[] = currentRepoConfig.skills || [];

    return {
      skillPaths,
    };
  });

  // Clean up on session shutdown
  pi.on("session_shutdown", async (_event, _ctx) => {
    currentRepoConfig = null;
  });
}
