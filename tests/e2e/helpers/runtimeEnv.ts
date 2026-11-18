import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, resolveProjectPath } from './contractLoader';

/**
 * Spec-compliant in-memory Storage implementation for Node Vitest Web-parity testing.
 */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.map.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value));
  }
}

export function installWebStorageShim(): MemoryStorage {
  const storage = new MemoryStorage();
  const g = globalThis as Record<string, any>;
  if (!g.window) {
    g.window = {};
  }
  g.window.localStorage = storage;
  g.localStorage = storage;
  return storage;
}

/**
 * Recursively collect all .ts/.tsx files under a workspace subdirectory.
 */
export function listSourceFiles(subDir: string, extensions = ['.ts', '.tsx']): string[] {
  const root = resolveProjectPath(subDir);
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.expo') continue;
        walk(full);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  };

  walk(root);
  return results.sort();
}

export function toRelativePath(absPath: string): string {
  return path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');
}

/**
 * WCAG 2.1 relative luminance & contrast ratio calculator.
 */
export function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [r, g, b];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Scans UI source files for forbidden hardcoded color classes or raw hexes.
 */
export function findHardcodedColorsInUi(): { file: string; match: string }[] {
  const uiFiles = [...listSourceFiles('app'), ...listSourceFiles('components')];
  const violations: { file: string; match: string }[] = [];

  const forbiddenPatterns = [
    /\bbg-(?:black|white)(?:\/\d+)?\b/g,
    /\btext-(?:black|white)(?:\/\d+)?\b/g,
    /\bborder-(?:black|white)(?:\/\d+)?\b/g,
    /\b(?:bg|text|border)-(?:indigo|emerald|amber|sky|rose|slate|zinc|gray|neutral|stone|red|blue|green|purple|violet|pink)-\d{2,3}(?:\/\d+)?\b/g,
    /#[0-9a-fA-F]{6}\b/g,
  ];

  for (const abs of uiFiles) {
    const content = fs.readFileSync(abs, 'utf8');
    const rel = toRelativePath(abs);
    for (const pattern of forbiddenPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const m of matches) {
          violations.push({ file: rel, match: m });
        }
      }
    }
  }
  return violations;
}

/**
 * Scans UI source files for sub-12px typography violations.
 */
export function findSub12pxFontsInUi(): { file: string; match: string }[] {
  const uiFiles = [...listSourceFiles('app'), ...listSourceFiles('components')];
  const violations: { file: string; match: string }[] = [];

  const patterns = [
    /\btext-\[(?:[1-9]|1[01])px\]/g,
    /\bfontSize\s*:\s*(?:[1-9]|1[01])(?:\.\d+)?\b/g,
  ];

  for (const abs of uiFiles) {
    const content = fs.readFileSync(abs, 'utf8');
    const rel = toRelativePath(abs);
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const m of matches) {
          violations.push({ file: rel, match: m });
        }
      }
    }
  }
  return violations;
}

/**
 * Scans UI source files for color emojis in rendered strings/UI.
 * Allows emojis inside comments, checks non-comment code/JSX text.
 */
export function findColorEmojisInUi(): { file: string; match: string }[] {
  const uiFiles = [...listSourceFiles('app'), ...listSourceFiles('components')];
  const violations: { file: string; match: string }[] = [];
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

  for (const abs of uiFiles) {
    const raw = fs.readFileSync(abs, 'utf8');
    // Strip block and single-line comments before checking UI strings
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const matches = stripped.match(emojiRegex);
    if (matches) {
      const rel = toRelativePath(abs);
      for (const m of matches) {
        violations.push({ file: rel, match: m });
      }
    }
  }
  return violations;
}
