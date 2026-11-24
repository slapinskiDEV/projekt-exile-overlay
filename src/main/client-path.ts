import { existsSync, readFileSync } from 'node:fs';
import { win32 } from 'node:path';

/**
 * Autowykrywanie `Client.txt` PoE 2. Sprawdzamy domyślne miejsca Steama
 * (z bibliotekami z `libraryfolders.vdf`) i wersji samodzielnej GGG.
 */

const GAME_DIR = 'Path of Exile 2';

export const DEFAULT_STEAM_ROOTS = [
  'C:\\Program Files (x86)\\Steam',
  'C:\\Program Files\\Steam',
];

export const STANDALONE_DIRS = [
  `C:\\Program Files (x86)\\Grinding Gear Games\\${GAME_DIR}`,
  `C:\\Program Files\\Grinding Gear Games\\${GAME_DIR}`,
];

/** Ścieżki bibliotek z `steamapps/libraryfolders.vdf` (format KeyValues Valve). */
export function parseLibraryFolders(vdf: string): string[] {
  const paths: string[] = [];
  const pattern = /"path"\s+"((?:[^"\\]|\\.)*)"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(vdf)) !== null) {
    paths.push((match[1] ?? '').replace(/\\\\/g, '\\'));
  }
  return paths;
}

/** Kandydaci w kolejności sprawdzania, bez duplikatów. */
export function candidateClientPaths(steamLibraries: string[]): string[] {
  const all = [
    ...steamLibraries.map((lib) => win32.join(lib, 'steamapps', 'common', GAME_DIR, 'logs', 'Client.txt')),
    ...STANDALONE_DIRS.map((dir) => win32.join(dir, 'logs', 'Client.txt')),
  ];
  const seen = new Set<string>();
  return all.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Istniejące pliki `Client.txt` na tym komputerze (zwykle zero albo jeden). */
export function detectClientTxt(exists: (path: string) => boolean = existsSync): string[] {
  const libraries = [...DEFAULT_STEAM_ROOTS];
  for (const root of DEFAULT_STEAM_ROOTS) {
    const vdf = win32.join(root, 'steamapps', 'libraryfolders.vdf');
    try {
      if (exists(vdf)) libraries.push(...parseLibraryFolders(readFileSync(vdf, 'utf8')));
    } catch {
      // Brak dostępu do pliku Steama — zostają domyślne ścieżki.
    }
  }
  return candidateClientPaths(libraries).filter((p) => exists(p));
}
