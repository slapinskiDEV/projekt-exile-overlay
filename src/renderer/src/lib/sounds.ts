import classic from '../assets/notify.wav';
import { NOTIFICATION_SOUNDS, type NotificationSoundId } from '@shared/settings';

/**
 * Dźwięki powiadomień (0.3.4). „Klasyczny” to plik z paczki, pozostałe są składane
 * na żywo z WebAudio — bez plików, licencji i ładowania.
 */

type Note = {
  /** Częstotliwość w Hz; `to` — płynne przejście do innej (glissando). */
  f: number;
  to?: number;
  /** Start i długość w sekundach. */
  at: number;
  len: number;
  wave?: OscillatorType;
  /** Głośność nuty względem całości (0–1). */
  gain?: number;
};

/**
 * 0.3.5: krótkie (do ~0,35 s) i wyraźnie różne — inna barwa i inny kształt melodii
 * (jeden ton, dwa w górę, akord, ślizg w dół, ślizg w górę, bęben…).
 */
const SYNTH: Record<Exclude<NotificationSoundId, 'classic'>, Note[]> = {
  // Pojedynczy, czysty „ping” z alikwotem.
  bell: [
    { f: 1760, at: 0, len: 0.35, gain: 0.7 },
    { f: 3520, at: 0, len: 0.15, gain: 0.2 },
  ],
  // Szybkie arpeggio w górę — trzy nuty co 50 ms.
  crystal: [
    { f: 1318.5, at: 0, len: 0.08, wave: 'triangle' },
    { f: 1760, at: 0.05, len: 0.08, wave: 'triangle' },
    { f: 2637, at: 0.1, len: 0.2, wave: 'triangle' },
  ],
  // Niski bęben: krótki ślizg w dół w basie.
  gong: [{ f: 180, to: 60, at: 0, len: 0.25, gain: 1 }],
  // Moneta: dwa szybkie piski w górę (8-bit).
  coin: [
    { f: 987.77, at: 0, len: 0.06, wave: 'square', gain: 0.3 },
    { f: 1318.5, at: 0.06, len: 0.2, wave: 'square', gain: 0.3 },
  ],
  // Akord durowy naraz — „ta-dam” w jednym uderzeniu.
  fanfare: [
    { f: 523.25, at: 0, len: 0.3, wave: 'sawtooth', gain: 0.18 },
    { f: 659.25, at: 0, len: 0.3, wave: 'sawtooth', gain: 0.18 },
    { f: 783.99, at: 0, len: 0.3, wave: 'sawtooth', gain: 0.18 },
  ],
  // Kropla: szybki ślizg z góry w dół.
  drop: [{ f: 1800, to: 500, at: 0, len: 0.18, gain: 0.8 }],
  // Pytanie: ślizg w górę.
  rune: [{ f: 400, to: 1300, at: 0, len: 0.22, wave: 'triangle', gain: 0.8 }],
  // Puls: dwa identyczne krótkie bzyki.
  pulse: [
    { f: 660, at: 0, len: 0.05, wave: 'square', gain: 0.3 },
    { f: 660, at: 0.11, len: 0.05, wave: 'square', gain: 0.3 },
  ],
  // Alarm: trzy szybkie naprzemienne tony.
  alarm: [
    { f: 1200, at: 0, len: 0.07, wave: 'sawtooth', gain: 0.22 },
    { f: 800, at: 0.09, len: 0.07, wave: 'sawtooth', gain: 0.22 },
    { f: 1200, at: 0.18, len: 0.09, wave: 'sawtooth', gain: 0.22 },
  ],
};

let context: AudioContext | null = null;

function synth(notes: Note[], volume: number) {
  context ??= new AudioContext();
  const ctx = context;
  void ctx.resume().catch(() => undefined);
  const now = ctx.currentTime + 0.02;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.wave ?? 'sine';
    osc.frequency.setValueAtTime(note.f, now + note.at);
    if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, now + note.at + note.len);
    const peak = Math.max(0.0001, volume * (note.gain ?? 0.6) * 0.5);
    const start = now + note.at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + note.len + 0.05);
  }
}

/** Odtwarza wybrany dźwięk; `volume` 0–100. Błędy odtwarzania są ciche. */
export function playNotificationSound(id: string, volume: number) {
  const v = Math.min(100, Math.max(0, volume)) / 100;
  if (v === 0) return;
  const known = NOTIFICATION_SOUNDS.some((s) => s.id === id) ? (id as NotificationSoundId) : 'classic';
  try {
    if (known === 'classic') {
      const audio = new Audio(classic);
      audio.volume = v;
      void audio.play().catch(() => undefined);
    } else {
      synth(SYNTH[known], v);
    }
  } catch {
    // Brak urządzenia audio — powiadomienie i tak się pokaże.
  }
}
