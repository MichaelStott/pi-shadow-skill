# pi-shadow-skill 🌑

Automatically load untracked repository-specific context and skill files. 

## Motivation

During development, developers may want their [pi](https://pi.dev/) harness to autoload agent skills or `AGENT.md` documentation for a repository without committing these files for a variety of reasons, such as:

- **Developer-specific resources**: Skills and context may be uniquely valuable to a developer's workflow, not needed by all collaborators
- **Work-in-progress**: Resources are still being refined and shouldn't be committed to version control

Rather than using global gitignore rules (which are cumbersome and don't sync across worktrees when cloning), **pi-shadow-skill** provides a clean way to define additional context and skills for your workflows that automatically load for the repository.

## How It Works

This pi package enables shadow skill loading via a configuration file.

1. Create a `shadow.json` file in `~/.pi/agent/` with your repository-specific skills and documentation
2. Define skills and documentation paths for your target repositories using their URLs as keys
3. The pi extension automatically discovers and loads them without requiring git commits
4. Your workflow context is preserved across worktrees and clones

### Configuration Schema

Create `~/.pi/agent/shadow.json` with the following structure:

```json
{
  "repo-url.com": {
    "skills": [
      "path/to/skill-file-1.md",
      "path/to/skill-file-2.md"
    ],
    "readme": [
      "path/to/readme-extension-1.md",
      "path/to/readme-extension-2.md"
    ]
  }
}
```

- **skills**: Array of paths to skill files (SKILL.md format) to load for this repository
- **readme**: Array of paths to documentation files to load as repository context

## Installation & Setup

1. Install the package with pi:

```bash
pi install npm:pi-shadow-skill
```

2. Restart your pi agent session so the extension is loaded.

You can verify installation by looking for a shadow-load notification (for example: `🌑 - Shadow config loaded: ...`) when starting a session inside a git repository.

### Configuring Skills for Your Repository

1. Create or edit `~/.pi/agent/shadow.json` (create the directory if it doesn't exist)
2. Add an entry for your repository:

```json
{
  "https://github.com/username/my-repo.git": {
    "skills": [
      "/home/user/my-skills/custom-skill.md",
      "/home/user/my-skills/workflow-skill.md"
    ],
    "readme": [
      "/home/user/docs/repo-context.md"
    ]
  }
}
```

The paths can be absolute paths to skill files on your system. When you work in that repository, these skills and documentation will automatically load.

## License

See repository for license information.
