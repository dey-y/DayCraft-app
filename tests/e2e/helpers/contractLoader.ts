import fs from 'node:fs';
import path from 'node:path';

export const PROJECT_ROOT = path.resolve(__dirname, '../../..');

export class ContractNotImplementedError extends Error {
  constructor(modulePath: string, reason?: string) {
    super(
      `Contract module "${modulePath}" is not available yet${reason ? `: ${reason}` : ''}`
    );
    this.name = 'ContractNotImplementedError';
  }
}

export function resolveProjectPath(...segments: string[]): string {
  return path.resolve(PROJECT_ROOT, ...segments);
}

export function projectFileExists(...segments: string[]): boolean {
  return fs.existsSync(resolveProjectPath(...segments));
}

export function readProjectFile(...segments: string[]): string {
  const fullPath = resolveProjectPath(...segments);
  if (!fs.existsSync(fullPath)) {
    throw new ContractNotImplementedError(segments.join('/'), 'File does not exist');
  }
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Dynamically imports a module relative to PROJECT_ROOT using runtime resolution
 * so E2E tests stay decoupled from M1-M4 build order while still exercising real modules.
 */
export async function loadContractModule<T = Record<string, any>>(
  relativeModulePath: string
): Promise<T> {
  const candidates = [
    resolveProjectPath(relativeModulePath),
    resolveProjectPath(`${relativeModulePath}.ts`),
    resolveProjectPath(`${relativeModulePath}.tsx`),
    resolveProjectPath(relativeModulePath, 'index.ts'),
    resolveProjectPath(relativeModulePath, 'server.ts'),
  ];

  const found = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!found) {
    throw new ContractNotImplementedError(
      relativeModulePath,
      'Module file has not been created yet by M1-M4'
    );
  }

  try {
    return (await import(/* @vite-ignore */ found)) as T;
  } catch (err) {
    throw new ContractNotImplementedError(
      relativeModulePath,
      err instanceof Error ? err.message : String(err)
    );
  }
}

export async function getTestRepository(): Promise<any> {
  const sqliteMod = await loadContractModule<any>('services/db/sqlite');
  const factory =
    sqliteMod.createMemoryRepository ||
    sqliteMod.createInMemoryRepository ||
    sqliteMod.createDayCraftRepository ||
    sqliteMod.getDayCraftRepository ||
    sqliteMod.getRepository;

  if (typeof factory !== 'function') {
    throw new ContractNotImplementedError(
      'services/db/sqlite#DayCraftRepository',
      'DayCraftRepository factory not yet implemented by M1'
    );
  }
  const repo = await factory();
  await repo.init?.();
  return repo;
}
