import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

import {
  ShadowConfigError,
  getRepoConfig,
  loadShadowConfig,
} from './config';

const readFileMock = vi.mocked(fs.readFile);

describe('loadShadowConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed config with default arrays', async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        'https://github.com/example/repo': {},
      })
    );

    const config = await loadShadowConfig();

    expect(config['https://github.com/example/repo']).toEqual({
      skills: [],
      readme: [],
    });
  });

  it('throws NOT_FOUND when shadow config does not exist', async () => {
    const missingError = Object.assign(new Error('missing'), { code: 'ENOENT' });
    readFileMock.mockRejectedValueOnce(missingError);

    await expect(loadShadowConfig()).rejects.toMatchObject<Partial<ShadowConfigError>>({
      code: 'NOT_FOUND',
    });
  });

  it('throws PARSE_ERROR for malformed json', async () => {
    readFileMock.mockResolvedValueOnce('{ invalid-json');

    await expect(loadShadowConfig()).rejects.toMatchObject<Partial<ShadowConfigError>>({
      code: 'PARSE_ERROR',
    });
  });

  it('throws VALIDATION_ERROR for schema mismatch', async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        'https://github.com/example/repo': {
          skills: 'not-an-array',
        },
      })
    );

    await expect(loadShadowConfig()).rejects.toMatchObject<Partial<ShadowConfigError>>({
      code: 'VALIDATION_ERROR',
    });
  });

  it('throws IO_ERROR for other read failures', async () => {
    readFileMock.mockRejectedValueOnce(new Error('permission denied'));

    await expect(loadShadowConfig()).rejects.toMatchObject<Partial<ShadowConfigError>>({
      code: 'IO_ERROR',
    });
  });
});

describe('getRepoConfig', () => {
  const config = {
    'https://github.com/acme/exact.git': { skills: ['exact'], readme: [] },
    'https://github.com/acme/strip': { skills: ['strip'], readme: [] },
    'https://mirror.local/github.com/acme/fallback': { skills: ['fallback'], readme: [] },
  };

  it('matches exact key first', () => {
    const result = getRepoConfig(config, 'https://github.com/acme/exact.git');
    expect(result?.skills).toEqual(['exact']);
  });

  it('matches git url after stripping .git suffix', () => {
    const result = getRepoConfig(config, 'https://github.com/acme/strip.git');
    expect(result?.skills).toEqual(['strip']);
  });

  it('matches based on hostname/path fallback', () => {
    const result = getRepoConfig(config, 'https://github.com/acme/fallback');
    expect(result?.skills).toEqual(['fallback']);
  });

  it('returns null for invalid url inputs', () => {
    expect(getRepoConfig(config, 'not-a-url')).toBeNull();
  });

  it('returns null when no repo entry matches', () => {
    expect(getRepoConfig(config, 'https://github.com/acme/missing')).toBeNull();
  });
});
