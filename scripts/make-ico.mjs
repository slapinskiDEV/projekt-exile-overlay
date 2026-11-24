// Składa build/icon.ico z plików PNG (16, 32, 48, 256 px). Ikony ICO z wpisami PNG
// są obsługiwane przez Windows od Visty. Użycie (macOS, sips):
//   for s in 16 32 48 256; do sips -z $s $s build/icon.png --out /tmp/icon-$s.png; done
//   node scripts/make-ico.mjs /tmp/icon-16.png /tmp/icon-32.png /tmp/icon-48.png /tmp/icon-256.png
import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Podaj pliki PNG.');
  process.exit(1);
}
const images = files.map((file) => {
  const data = readFileSync(file);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  return { data, width, height };
});

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

const entries = [];
let offset = 6 + 16 * images.length;
for (const image of images) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(image.width >= 256 ? 0 : image.width, 0);
  entry.writeUInt8(image.height >= 256 ? 0 : image.height, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.data.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += image.data.length;
  entries.push(entry);
}

writeFileSync('build/icon.ico', Buffer.concat([header, ...entries, ...images.map((i) => i.data)]));
console.log(`build/icon.ico: ${images.length} rozmiarów`);
