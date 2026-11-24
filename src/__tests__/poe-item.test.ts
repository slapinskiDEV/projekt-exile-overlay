import { describe, expect, it } from 'vitest';
import { modifierKind, parseItemText } from '@shared/poe-item';

const RARE = `Item Class: Body Armours
Rarity: Rare
Doom Shell
Advanced Plate Vest
--------
Armour: 512 (augmented)
--------
Requires: Level 54, 86 Str
--------
Item Level: 68
--------
+15% to Fire Resistance (implicit)
--------
+82 to maximum Life
+31% to Cold Resistance
`;

// Ctrl+Alt+C (Alt wciąż wciśnięty przy Alt+C) — rozszerzony opis z nawiasami.
const ADVANCED = `Item Class: Rings
Rarity: Magic
Sapphire Ring of the Fox
--------
Requires: Level 20
--------
Item Level: 33
--------
{ Implicit Modifier }
+24(20-30)% to Cold Resistance (implicit)
--------
{ Suffix Modifier "of the Fox" (Tier: 7) — Attribute }
+9(8-12) to Dexterity
`;

describe('parseItemText', () => {
  it('parses a rare item', () => {
    const item = parseItemText(RARE)!;
    expect(item.rarity).toBe('rare');
    expect(item.name).toBe('Doom Shell');
    expect(item.baseType).toBe('Advanced Plate Vest');
    expect(item.itemClass).toBe('Body Armours');
    expect(item.sections).toHaveLength(5);
  });

  it('tolerates the advanced description', () => {
    const item = parseItemText(ADVANCED.replace(/\n/g, '\r\n'))!;
    expect(item.rarity).toBe('magic');
    expect(item.name).toBe('Sapphire Ring of the Fox');
  });

  it('returns null for plain text', () => {
    expect(parseItemText('hello world')).toBeNull();
    expect(parseItemText('')).toBeNull();
  });

  it('classifies modifier lines', () => {
    expect(modifierKind('+15% to Fire Resistance (implicit)')).toBe('implicit');
    expect(modifierKind('Requires: Level 54')).toBe('requirement');
    expect(modifierKind('Item Level: 68')).toBe('property');
    expect(modifierKind('+82 to maximum Life')).toBe('plain');
  });
});
