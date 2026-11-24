/**
 * Skróty klawiszowe (format akceleratora Electrona, np. `Alt+H`). Czyste funkcje —
 * walidacja w ustawieniach i w procesie głównym używa tego samego kodu.
 */

export type ShortcutAction = 'togglePanel' | 'requestHelp' | 'askItem';

export type ShortcutMap = Record<ShortcutAction, string>;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  togglePanel: 'Alt+H',
  requestHelp: 'Alt+P',
  askItem: 'Alt+C',
};

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  togglePanel: 'Pokaż / ukryj panel',
  requestHelp: 'Poproś o pomoc',
  askItem: 'Zapytaj o przedmiot',
};

const MODIFIERS = ['Ctrl', 'Alt', 'Shift'] as const;

/** Klawisze, które można przypisać (bez modyfikatora tylko F1–F24). */
const KEY = /^(?:[A-Z0-9]|F(?:[1-9]|1\d|2[0-4]))$/;

/** Ujednolica zapis: kolejność modyfikatorów Ctrl, Alt, Shift; wielkie litery klawisza. */
export function normalizeAccelerator(value: string): string {
  const parts = value
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const mods = new Set<string>();
  let key = '';
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control' || lower === 'commandorcontrol' || lower === 'cmdorctrl') mods.add('Ctrl');
    else if (lower === 'alt' || lower === 'option') mods.add('Alt');
    else if (lower === 'shift') mods.add('Shift');
    else key = part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
  }
  return [...MODIFIERS.filter((m) => mods.has(m)), key].filter(Boolean).join('+');
}

/** Komunikat błędu po polsku albo `null`, gdy skrót jest poprawny. */
export function validateAccelerator(value: string): string | null {
  const normalized = normalizeAccelerator(value);
  const parts = normalized.split('+');
  const key = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1);
  if (!key || !KEY.test(key)) return 'Wybierz literę, cyfrę albo klawisz F1–F24.';
  if (mods.length === 0 && !key.startsWith('F')) {
    return 'Litera albo cyfra musi mieć modyfikator (Alt, Ctrl albo Shift).';
  }
  if (mods.length === 1 && mods[0] === 'Shift' && !key.startsWith('F')) {
    return 'Shift z literą blokowałby pisanie wielkich liter — dodaj Alt albo Ctrl.';
  }
  if (mods.includes('Ctrl') && !mods.includes('Alt') && !mods.includes('Shift') && key === 'C') {
    return 'Ctrl+C jest potrzebny grze do kopiowania przedmiotów.';
  }
  if (mods.includes('Ctrl') && !mods.includes('Alt') && !mods.includes('Shift') && key === 'V') {
    return 'Ctrl+V jest potrzebny do wklejania.';
  }
  return null;
}

/** Błędy dla każdego skrótu — także konflikty między nimi. */
export function validateShortcuts(map: ShortcutMap): Partial<Record<ShortcutAction, string>> {
  const errors: Partial<Record<ShortcutAction, string>> = {};
  const seen = new Map<string, ShortcutAction>();
  for (const action of Object.keys(map) as ShortcutAction[]) {
    const error = validateAccelerator(map[action]);
    if (error) {
      errors[action] = error;
      continue;
    }
    const normalized = normalizeAccelerator(map[action]);
    const other = seen.get(normalized);
    if (other) {
      errors[action] = `Ten sam skrót co „${SHORTCUT_LABELS[other]}”.`;
    } else {
      seen.set(normalized, action);
    }
  }
  return errors;
}

/** Skrót z wciśniętego klawisza (pole „naciśnij skrót” w ustawieniach). */
export function acceleratorFromKeyEvent(event: {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): string | null {
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if (/^Digit\d$/.test(event.code)) key = event.code.slice(5);
  else if (/^F\d{1,2}$/.test(event.code)) key = event.code;
  if (!key) return null;
  const mods: string[] = [];
  if (event.ctrlKey) mods.push('Ctrl');
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey) mods.push('Shift');
  return [...mods, key].join('+');
}
