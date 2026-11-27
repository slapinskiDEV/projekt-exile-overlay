import type { ContractStatus } from '@shared/api-types';

export const STATUS_LABELS: Record<ContractStatus, string> = {
  open: 'Otwarty',
  taken: 'W realizacji',
  in_progress: 'W realizacji',
  completed: 'Zakończony',
  community_review: 'Ocena społeczności',
  verified: 'Zweryfikowany',
  rejected: 'Odrzucony',
  disputed: 'Spór',
  cancelled: 'Zamknięty',
  expired: 'Wygasł',
};

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'przed chwilą';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'wczoraj' : `${days} dni temu`;
}

export function areaLabel(area: string | null, level: number | null): string | null {
  if (!area && !level) return null;
  if (!area) return `poziom obszaru ${level}`;
  return level ? `${area} (poziom obszaru ${level})` : area;
}

export const CONTRACT_URL = (id: string) => `https://projektexile.pl/contracts/${id}`;

/** Zapas na wypadek braku połączenia z API — normalnie kategorie przychodzą ze strony. */
export const REQUEST_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'boss_carry', label: 'Pomoc z bossem' },
  { id: 'campaign', label: 'Kampania' },
  { id: 'leveling', label: 'Levelowanie / akt' },
  { id: 'mapping', label: 'Mapy / endgame' },
  { id: 'crafting', label: 'Crafting / przedmiot' },
  { id: 'other', label: 'Inne' },
];
