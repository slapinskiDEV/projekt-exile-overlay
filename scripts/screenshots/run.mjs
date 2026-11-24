// Generuje docs/screenshots/*.png: `npm run build && node scripts/screenshots/run.mjs`
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electron = require('electron');
const script = fileURLToPath(new URL('./capture.cjs', import.meta.url));

for (const scene of ['panel', 'detail-item', 'request', 'wizard', 'settings']) {
  const result = spawnSync(electron, [script], { stdio: 'inherit', env: { ...process.env, SCENE: scene } });
  if (result.status !== 0) {
    console.error(`Scena ${scene} nie powiodła się.`);
    process.exit(1);
  }
}
