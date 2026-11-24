/**
 * Porównanie wersji `X.Y.Z` — ta sama funkcja co w serwisie
 * (`src/lib/overlay/version.ts`). Brakujące człony liczą się jako zero.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/, '')
      .split(/[.-]/)
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0);
  const [a1 = 0, a2 = 0, a3 = 0] = parse(a);
  const [b1 = 0, b2 = 0, b3 = 0] = parse(b);
  return a1 - b1 || a2 - b2 || a3 - b3;
}

export function isBelowMinVersion(version: string, minVersion: string): boolean {
  return compareVersions(version, minVersion) < 0;
}
