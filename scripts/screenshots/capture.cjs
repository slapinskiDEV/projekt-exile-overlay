// Zrzuty ekranu do README. Uruchamiane przez run.mjs — jedna scena na proces Electrona.
// Startuje atrapę API, podkłada ustawienia i plik Client.txt, ładuje zbudowaną
// aplikację (out/main) i zapisuje PNG do docs/screenshots/.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { start } = require('./mock-api.cjs');

const root = path.resolve(__dirname, '../..');
const scene = process.env.SCENE;
const outDir = path.join(root, 'docs/screenshots');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-shots-'));
const pkg = require(path.join(root, 'package.json'));

app.getVersion = () => pkg.version;
app.setName('Projekt Exile Overlay');
app.setPath('userData', path.join(work, 'userdata'));
process.env.PE_API_URL = 'http://127.0.0.1:4789/api/overlay';

const clientTxt = path.join(work, 'Client.txt');
fs.writeFileSync(
  clientTxt,
  [
    '2026/11/24 20:14:02 1 a [INFO Client 1] Wygnaniec: ktoś na bossa?',
    '2026/11/24 20:15:10 2 b [DEBUG Client 1] Generating level 45 area "G3_10" with seed 1',
    '2026/11/24 20:15:11 3 c [INFO Client 1] : You have entered Przejście Zdrajcy.',
    '',
  ].join('\n'),
);

const settings = {
  wizard: {},
  settings: { privacyAccepted: true, setupDone: true, league: 'Dawn', mode: 'preview', nick: 'Wygnaniec', clientTxtPath: clientTxt },
}[scene] ?? {
  privacyAccepted: true,
  setupDone: true,
  league: 'Dawn',
  mode: 'paired',
  nick: 'Wygnaniec',
  clientTxtPath: clientTxt,
  profile: { id: 'u1', displayName: 'Wygnaniec', level: 12, reputation: 340 },
  tokenPlain: 'pex_mock',
};
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata/settings.json'), JSON.stringify(settings));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const GAME_BG = `
  html, body { background:
    radial-gradient(ellipse 60% 50% at 28% 62%, rgba(201,120,40,0.28), transparent 70%),
    radial-gradient(ellipse 50% 40% at 70% 20%, rgba(70,90,110,0.25), transparent 70%),
    linear-gradient(160deg, #1b1712 0%, #0d0b09 55%, #050404 100%) !important; }`;

async function save(win, file, rect) {
  const image = await win.webContents.capturePage(rect);
  fs.writeFileSync(path.join(outDir, file), image.toPNG());
  console.log('zapisano', file);
}

async function panelRect(win, margin = 36) {
  const r = await win.webContents.executeJavaScript(
    'JSON.parse(JSON.stringify(document.querySelector(".panel").getBoundingClientRect()))',
  );
  const [w] = win.getContentSize();
  const x = Math.max(0, Math.floor(r.x - margin));
  return { x, y: Math.max(0, Math.floor(r.y - margin)), width: Math.min(w - x, Math.ceil(r.width + margin * 2)), height: Math.ceil(r.height + margin * 2) };
}

async function overlayScene(win) {
  await win.webContents.insertCSS(GAME_BG);
  await win.webContents.executeJavaScript('window.overlay.setPanelVisible(true)');
  await wait(2500);
  if (scene === 'panel') return save(win, 'panel.png', await panelRect(win));
  if (scene === 'detail-item') {
    await win.webContents.executeJavaScript(`[...document.querySelectorAll('.list-item')].find(b => b.textContent.includes('craftować')).click()`);
    await wait(2000);
    return save(win, 'detail-item.png', await panelRect(win));
  }
  if (scene === 'request') {
    await win.webContents.executeJavaScript(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Poproś').click()`);
    await wait(800);
    await win.webContents.executeJavaScript(`document.getElementById('req-text').focus()`);
    await win.webContents.insertText('Potrzebuję pomocy z bossem, ginę w drugiej fazie');
    await wait(500);
    return save(win, 'request.png', await panelRect(win));
  }
}

app.on('browser-window-created', (_e, win) => {
  win.webContents.once('did-finish-load', async () => {
    await wait(1500);
    const url = win.webContents.getURL();
    try {
      if (url.endsWith('#overlay') && !['wizard', 'settings'].includes(scene)) await overlayScene(win);
      else if (url.endsWith('#overlay') && scene === 'settings') await win.webContents.executeJavaScript('window.overlay.openSettings()');
      else if (url.includes('#setup') && scene === 'wizard') await save(win, 'wizard-privacy.png');
      else if (url.includes('#settings') && scene === 'settings') await save(win, 'settings.png');
      else return;
    } catch (error) {
      console.error(error);
    }
    if (!(url.endsWith('#overlay') && scene === 'settings')) setTimeout(() => app.exit(0), 300);
  });
});

setTimeout(() => app.exit(1), 30_000);
start().then(() => require(path.join(root, 'out/main/index.js')));
