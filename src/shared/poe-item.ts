/**
 * Parser tekstu przedmiotu skopiowanego z gry (Ctrl+C nad przedmiotem) — spec 0158.
 *
 * Gra kopiuje przedmiot jako zwykły tekst: nagłówek z klasą, rzadkością i nazwą,
 * a dalej sekcje rozdzielone linią `--------`. Tekst zapisujemy w kontrakcie bez
 * zmian; parser służy wyłącznie do wyświetlenia go jako karty przedmiotu. Ten sam
 * plik jest kopiowany do repozytorium overlaya, więc nie może zależeć od niczego
 * poza samym TypeScriptem.
 *
 * Obsługiwany jest klient angielski i polski. Nieznany format nie jest błędem:
 * karta pokazuje wtedy tekst bez kolorów.
 */

export type ItemRarity =
  | 'normal'
  | 'magic'
  | 'rare'
  | 'unique'
  | 'currency'
  | 'gem'
  | 'other';

export interface ParsedItem {
  itemClass: string | null;
  rarity: ItemRarity;
  /** Nazwa własna (rzadkie i unikatowe) albo pełna nazwa (pozostałe). */
  name: string | null;
  /** Podstawa przedmiotu, gdy nagłówek ma dwie linie nazwy. */
  baseType: string | null;
  /** Sekcje po nagłówku, każda jako lista linii. */
  sections: string[][];
}

const SEPARATOR = /^-{4,}\s*$/;

const CLASS_PREFIXES = ['Item Class:', 'Klasa przedmiotu:'];
const RARITY_PREFIXES = ['Rarity:', 'Rzadkość:'];

const RARITY_WORDS: Record<string, ItemRarity> = {
  normal: 'normal',
  zwykły: 'normal',
  normalny: 'normal',
  magic: 'magic',
  magiczny: 'magic',
  rare: 'rare',
  rzadki: 'rare',
  unique: 'unique',
  unikatowy: 'unique',
  currency: 'currency',
  waluta: 'currency',
  gem: 'gem',
  klejnot: 'gem',
};

function afterPrefix(line: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (line.toLowerCase().startsWith(prefix.toLowerCase())) {
      return line.slice(prefix.length).trim();
    }
  }
  return null;
}

export function parseItemText(text: string): ParsedItem | null {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());

  const sections: string[][] = [];
  let current: string[] = [];
  sections.push(current);
  for (const line of lines) {
    if (SEPARATOR.test(line.trim())) {
      current = [];
      sections.push(current);
    } else if (line.trim() !== '') {
      current.push(line.trim());
    }
  }

  const [header, ...rest] = sections.filter((section) => section.length > 0);
  if (!header) return null;
  let itemClass: string | null = null;
  let rarityText: string | null = null;
  const names: string[] = [];

  for (const line of header) {
    const klasa = afterPrefix(line, CLASS_PREFIXES);
    if (klasa !== null) {
      itemClass = klasa;
      continue;
    }
    const rzadkosc = afterPrefix(line, RARITY_PREFIXES);
    if (rzadkosc !== null) {
      rarityText = rzadkosc;
      continue;
    }
    names.push(line);
  }

  // Bez linii „Rarity:” to najpewniej nie jest przedmiot z gry — zwykły tekst.
  if (rarityText === null) return null;

  const rarity = RARITY_WORDS[rarityText.toLowerCase()] ?? 'other';

  return {
    itemClass,
    rarity,
    name: names[0] ?? null,
    baseType: names.length > 1 ? names.slice(1).join(' ') : null,
    sections: rest,
  };
}

/** Kolor nazwy według rzadkości — te same barwy, co w grze. */
export const RARITY_COLORS: Record<ItemRarity, string> = {
  normal: '#c8c8c8',
  magic: '#8888ff',
  rare: '#ffff77',
  unique: '#af6025',
  currency: '#aa9e82',
  gem: '#1ba29b',
  other: '#c8c8c8',
};

/** Rodzaj linii modyfikatora — do przyciemnienia dopisków w nawiasach. */
export function modifierKind(
  line: string,
):
  | 'implicit'
  | 'enchant'
  | 'rune'
  | 'crafted'
  | 'requirement'
  | 'property'
  | 'plain' {
  const lower = line.toLowerCase();
  if (lower.endsWith('(implicit)')) return 'implicit';
  if (lower.endsWith('(enchant)')) return 'enchant';
  if (lower.endsWith('(rune)')) return 'rune';
  if (lower.endsWith('(crafted)') || lower.endsWith('(desecrated)')) return 'crafted';
  if (lower.startsWith('requires') || lower.startsWith('wymaga')) return 'requirement';
  // „Item Level: 60”, „Armour: 120”, „Quality: +20%” — właściwości, nie modyfikatory.
  if (/^[\p{L} ]+: /u.test(line)) return 'property';
  return 'plain';
}
