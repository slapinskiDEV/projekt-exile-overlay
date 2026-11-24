// Generuje krótki dźwięk powiadomienia (dwa tony, ~0,35 s, mono 16-bit 22 050 Hz)
// do src/renderer/src/assets/notify.wav. Plik jest syntetyzowany w kodzie, więc nie ma
// żadnej licencji poza licencją repozytorium.
import { writeFileSync } from 'node:fs';

const rate = 22050;
const tones = [
  { freq: 880, start: 0, length: 0.14 },
  { freq: 1318.5, start: 0.12, length: 0.22 },
];
const total = Math.ceil(rate * 0.36);
const samples = new Float32Array(total);

for (const tone of tones) {
  const from = Math.floor(tone.start * rate);
  const count = Math.floor(tone.length * rate);
  for (let i = 0; i < count && from + i < total; i++) {
    const t = i / rate;
    const attack = Math.min(1, i / (rate * 0.005));
    const decay = Math.exp(-t * 14);
    samples[from + i] += Math.sin(2 * Math.PI * tone.freq * t) * attack * decay * 0.45;
  }
}

const data = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) {
  const v = Math.max(-1, Math.min(1, samples[i]));
  data.writeInt16LE(Math.round(v * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

writeFileSync('src/renderer/src/assets/notify.wav', Buffer.concat([header, data]));
console.log('src/renderer/src/assets/notify.wav');
