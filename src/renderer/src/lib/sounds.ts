import classic from '../assets/notify.wav';
import { NOTIFICATION_SOUNDS, type NotificationSoundId } from '@shared/settings';

/**
 * Dźwięki powiadomień (0.3.4). „Klasyczny” to plik z paczki, pozostałe są składane
 * na żywo z WebAudio — bez plików, licencji i ładowania.
 */

type Note = {
  /** Częstotliwość w Hz. */
  f: number;
  /** Start i długość w sekundach. */
  at: number;
  len: number;
  wave?: OscillatorType;
  /** Głośność nuty względem całości (0–1). */
  gain?: number;
};

const SYNTH: Record<Exclude<NotificationSoundId, 'classic'>, Note[]> = {
  bell: [
    { f: 1318.5, at: 0, len: 0.9 },
    { f: 2637, at: 0, len: 0.5, gain: 0.25 },
  ],
  crystal: [
    { f: 1567.98, at: 0, len: 0.25, wave: 'triangle' },
    { f: 2093, at: 0.09, len: 0.25, wave: 'triangle' },
    { f: 2637, at: 0.18, len: 0.45, wave: 'triangle' },
  ],
  gong: [
    { f: 196, at: 0, len: 1.6, gain: 0.9 },
    { f: 293.66, at: 0, len: 1.2, gain: 0.35 },
    { f: 523.25, at: 0, len: 0.6, gain: 0.15 },
  ],
  coin: [
    { f: 987.77, at: 0, len: 0.08, wave: 'square', gain: 0.35 },
    { f: 1318.5, at: 0.08, len: 0.35, wave: 'square', gain: 0.35 },
  ],
  fanfare: [
    { f: 523.25, at: 0, len: 0.12, wave: 'sawtooth', gain: 0.3 },
    { f: 659.25, at: 0.12, len: 0.12, wave: 'sawtooth', gain: 0.3 },
    { f: 783.99, at: 0.24, len: 0.12, wave: 'sawtooth', gain: 0.3 },
    { f: 1046.5, at: 0.36, len: 0.4, wave: 'sawtooth', gain: 0.3 },
  ],
  drop: [
    { f: 1760, at: 0, len: 0.12, gain: 0.8 },
    { f: 880, at: 0.1, len: 0.25, gain: 0.6 },
  ],
  rune: [
    { f: 440, at: 0, len: 0.5, wave: 'triangle' },
    { f: 554.37, at: 0.15, len: 0.5, wave: 'triangle' },
    { f: 659.25, at: 0.3, len: 0.8, wave: 'triangle' },
  ],
  pulse: [
    { f: 880, at: 0, len: 0.1, wave: 'square', gain: 0.3 },
    { f: 880, at: 0.18, len: 0.1, wave: 'square', gain: 0.3 },
  ],
  alarm: [
    { f: 1046.5, at: 0, len: 0.14, wave: 'square', gain: 0.3 },
    { f: 783.99, at: 0.16, len: 0.14, wave: 'square', gain: 0.3 },
    { f: 1046.5, at: 0.32, len: 0.14, wave: 'square', gain: 0.3 },
    { f: 783.99, at: 0.48, len: 0.14, wave: 'square', gain: 0.3 },
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
    osc.frequency.value = note.f;
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
