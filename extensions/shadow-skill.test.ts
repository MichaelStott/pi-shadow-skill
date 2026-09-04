import { describe, expect, it, vi } from 'vitest';
import type { ShadowConfig } from '../src/config';
import {
  buildLoadMessage,
  createBeforeAgentStartResult,
  getGitUrl,
  loadReadmeContents,
  resolveRepoConfig,
} from './shadow-skill';

describe('getGitUrl', () => {
  it('returns origin remote url when present', async () => {
    const gitClientFactory = () => ({
      getConfig: vi.fn().mockResolvedValue({ value: 'git@github.com:acme/repo.git' }),
      getRemotes: vi.fn().mockResolvedValue([]),
    });

    await expect(getGitUrl(gitClientFactory)).resolves.toBe('git@github.com:acme/repo.git');
  });

  it('falls back to upstream remote when origin is missing', async () => {
    const gitClientFactory = () => ({
      getConfig: vi.fn().mockResolvedValue({ value: '' }),
      getRemotes: vi.fn().mockResolvedValue([
        { name: 'upstream', refs: { fetch: 'https://github.com/acme/upstream.git' } },
      ]),
    });

    await expect(getGitUrl(gitClientFactory)).resolves.toBe('https://github.com/acme/upstream.git');
  });

  it('returns null when git lookup fails', async () => {
    const gitClientFactory = () => ({
      getConfig: vi.fn().mockRejectedValue(new Error('git unavailable')),
      getRemotes: vi.fn(),
    });

    await expect(getGitUrl(gitClientFactory)).resolves.toBeNull();
  });
});

describe('loadReadmeContents', () => {
  it('loads all readable files and reports per-file failures', async () => {
    const readFile = vi
      .fn()
      .mockResolvedValueOnce('# First')
      .mockRejectedValueOnce(new Error('missing'))
      .mockResolvedValueOnce('# Third');

    const result = await loadReadmeContents(
      ['first.md', 'missing.md', 'third.md'],
      readFile
    );

    expect(result.contents).toEqual(['# First', '# Third']);
    expect(result.errors).toEqual([{ path: 'missing.md', message: 'missing' }]);
  });
});

describe('buildLoadMessage', () => {
  it('formats skill and readme counts', () => {
    const message = buildLoadMessage({
      skills: ['a', 'b'],
      readme: ['README.md'],
    });

    expect(message).toBe('🌑 - Shadow config loaded: 2 skill(s), 1 readme(s)');
  });
});

describe('createBeforeAgentStartResult', () => {
  it('returns undefined when no readmes are loaded', () => {
    expect(createBeforeAgentStartResult('base-prompt', [])).toBeUndefined();
  });

  it('appends readme content to system prompt', () => {
    const result = createBeforeAgentStartResult('base-prompt', ['# A', '# B']);
    expect(result).toEqual({
      systemPrompt: 'base-prompt\n\n## Shadow Context Files\n\n# A\n\n---\n\n# B',
    });
  });
});

describe('resolveRepoConfig', () => {
  it('returns cached config immediately when present', async () => {
    const cached = { skills: ['cached'], readme: [] };
    const getGitUrlFn = vi.fn();

    const result = await resolveRepoConfig({
      currentRepoConfig: cached,
      getGitUrlFn,
    });

    expect(result).toBe(cached);
    expect(getGitUrlFn).not.toHaveBeenCalled();
  });

  it('returns null when git url cannot be resolved', async () => {
    const result = await resolveRepoConfig({
      currentRepoConfig: null,
      getGitUrlFn: vi.fn().mockResolvedValue(null),
    });

    expect(result).toBeNull();
  });

  it('loads and selects repo config when git url exists', async () => {
    const selected = { skills: ['ok'], readme: ['README.md'] };
    const gitUrl = 'https://github.com/acme/repo.git';
    const shadowConfig: ShadowConfig = {
      [gitUrl]: selected,
    };

    const result = await resolveRepoConfig({
      currentRepoConfig: null,
      getGitUrlFn: vi.fn().mockResolvedValue(gitUrl),
      loadShadowConfigFn: vi.fn().mockResolvedValue(shadowConfig),
      getRepoConfigFn: vi.fn().mockReturnValue(selected),
    });

    expect(result).toEqual(selected);
  });
});
