// Lokalna atrapa API overlaya z przykładowymi danymi — tylko do zrzutów ekranu.
const http = require('node:http');

const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const ITEM = [
  'Item Class: Body Armours',
  'Rarity: Rare',
  'Kolos Burzy',
  'Advanced Plate Vest',
  '--------',
  'Armour: 812 (augmented)',
  '--------',
  'Requires: Level 65, 121 Str',
  '--------',
  'Item Level: 79',
  '--------',
  '+15% to Fire Resistance (implicit)',
  '--------',
  '+112 to maximum Life',
  '+38% to Cold Resistance',
  '+24% to Lightning Resistance',
  '14% increased Armour',
].join('\n');

const base = {
  description: '',
  status: 'open',
  contractType: 'individual',
  league: 'Dawn',
  maxHelpers: 6,
};
const contracts = [
  { ...base, id: '11111111-1111-4111-8111-111111111111', title: 'Pomoc z bossem w Przejściu Zdrajcy', categoryId: 'boss_carry', categoryLabel: 'Pomoc z bossem', area: 'Przejście Zdrajcy', areaLevel: 45, rpValue: 15, helpersCount: 1, issuer: { id: 'u2', name: 'Wilczyca' }, createdAt: ago(4), areaRank: 0 },
  { ...base, id: '22222222-2222-4222-8222-222222222222', title: 'Szukam ekipy na Jamanrę, sam nie daję rady', categoryId: 'boss_carry', categoryLabel: 'Pomoc z bossem', area: 'Wyschnięte Jezioro', areaLevel: 44, rpValue: 15, helpersCount: 0, issuer: { id: 'u3', name: 'KrwawyMnich' }, createdAt: ago(11), areaRank: 1 },
  { ...base, id: '33333333-3333-4333-8333-333333333333', title: 'Co dalej craftować na tej zbroi?', categoryId: 'crafting', categoryLabel: 'Crafting / przedmiot', area: null, areaLevel: null, rpValue: 10, helpersCount: 0, issuer: { id: 'u4', name: 'Rzemieślnik_PL' }, createdAt: ago(23), areaRank: 2 },
  { ...base, id: '44444444-4444-4444-8444-444444444444', contractType: 'community', title: 'Mapy T15 w drużynie — wolne 3 miejsca', categoryId: 'mapping', categoryLabel: 'Mapy / endgame', area: 'Mapa: Bagno Pochówku', areaLevel: 79, rpValue: 20, helpersCount: 3, issuer: { id: 'u5', name: 'Kartograf' }, createdAt: ago(38), areaRank: 2 },
  { ...base, id: '55555555-5555-4555-8555-555555555555', title: 'Pomoc z przejściem aktu 3 na nowej postaci', categoryId: 'leveling', categoryLabel: 'Levelowanie / akt', area: 'Dżungla Jiquani', areaLevel: 52, rpValue: 10, helpersCount: 0, issuer: { id: 'u6', name: 'NowyWygnaniec' }, createdAt: ago(55), areaRank: 2 },
];

const detail = {
  contract: {
    ...contracts[2],
    description: 'Co dalej craftować na tej zbroi? Mam sporo życia i odporności, ale nie wiem, czy ryzykować Exalted Orb.\n\nProśba wysłana z Projekt Exile Overlay.',
    itemText: ITEM,
    contractorId: null,
    expiryWarnedAt: null,
  },
  applications: [
    { id: 'a1', applicantId: 'u7', applicantName: 'StaryKowal', status: 'pending', message: 'Dorzuć Essence of the Body, potem spróbuj Exalta.', createdAt: ago(8) },
  ],
  messages: [
    { id: 'm1', authorId: 'u4', authorName: 'Rzemieślnik_PL', content: 'Gram build na Warriorze, liczy się głównie życie.', createdAt: ago(15) },
  ],
};

const categories = [
  { id: 'boss_carry', label: 'Pomoc z bossem' },
  { id: 'leveling', label: 'Levelowanie / akt' },
  { id: 'mapping', label: 'Mapy / endgame' },
  { id: 'crafting', label: 'Crafting / przedmiot' },
  { id: 'other', label: 'Inne' },
];

function start(port = 4789) {
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname.replace(/^\/api\/overlay\//, '');
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (path === 'version') return send(200, { minVersion: '0.1.0' });
    if (path === 'leagues') return send(200, { leagues: [{ id: 'Dawn', name: 'Dawn of the Hunt' }, { id: 'Standard', name: 'Standard' }, { id: 'Hardcore Dawn', name: 'Hardcore Dawn of the Hunt' }] });
    if (path === 'categories') return send(200, { categories });
    if (path === 'contracts') return send(200, { contracts });
    if (path.startsWith('contracts/')) return send(200, detail);
    if (path === 'threads') return send(200, { threads: [] });
    if (path === 'me') return send(200, { profile: { id: 'u1', displayName: 'Wygnaniec', level: 12, reputation: 340 }, contracts: [] });
    if (path === 'notifications') return send(200, { notifications: [] });
    send(404, { error: 'not_found', message: 'Nie znaleziono.' });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

module.exports = { start };
if (require.main === module) start().then(() => console.log('Atrapa API: http://127.0.0.1:4789/api/overlay'));
