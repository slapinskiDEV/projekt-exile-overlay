// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OverlayContract } from '@shared/api-types';
import { ItemCard } from '../renderer/src/components/ItemCard';
import { ContractRow } from '../renderer/src/overlay/ContractRow';

afterEach(cleanup);

const ITEM = `Item Class: Rings
Rarity: Unique
Blackheart
Iron Ring
--------
Requires: Level 8
--------
Adds 1 to 4 Physical Damage to Attacks (implicit)
--------
+5 to Strength`;

describe('ItemCard', () => {
  it('shows the name in the rarity colour and copies the raw text', async () => {
    const onCopy = vi.fn(async () => undefined);
    render(<ItemCard text={ITEM} onCopy={onCopy} />);
    expect(screen.getByText('Blackheart').getAttribute('style')).toContain('rgb(175, 96, 37)');
    expect(screen.getByText('Iron Ring')).toBeTruthy();
    fireEvent.click(screen.getByText('Kopiuj tekst'));
    expect(onCopy).toHaveBeenCalledWith(ITEM);
  });

  it('falls back to plain text for unknown content', () => {
    const { container } = render(<ItemCard text="zwykły tekst" />);
    expect(container.querySelector('pre')?.textContent).toBe('zwykły tekst');
    expect(container.firstElementChild?.getAttribute('data-item-rarity')).toBe('unknown');
  });
});

describe('ContractRow', () => {
  const contract: OverlayContract = {
    id: 'c1',
    title: 'Pomoc z bossem aktu 2',
    description: '',
    status: 'open',
    contractType: 'individual',
    categoryId: 'boss_carry',
    categoryLabel: 'Pomoc z bossem',
    league: 'Dawn',
    area: 'Przejście Zdrajcy',
    areaLevel: 22,
    rpValue: 15,
    helpersCount: 2,
    maxHelpers: 6,
    issuer: { id: 'u1', name: 'ExileOne' },
    createdAt: new Date().toISOString(),
    areaRank: 0,
    kind: 'request',
    payment: null,
  };

  it('shows helpers, RP, area and the same-area badge', () => {
    const onOpen = vi.fn();
    render(<ContractRow contract={contract} onOpen={onOpen} />);
    expect(screen.getByText('pomocnicy 2/6')).toBeTruthy();
    expect(screen.getByText((_, el) => el?.className === 'side-rp' && el.textContent === '15 RP')).toBeTruthy();
    expect(screen.getByText('Przejście Zdrajcy (poziom obszaru 22)')).toBeTruthy();
    expect(screen.getByText('Ten obszar')).toBeTruthy();
    fireEvent.click(screen.getByText('Pomoc z bossem aktu 2'));
    expect(onOpen).toHaveBeenCalledWith('c1');
  });

  it('marks the ±5 level match', () => {
    render(<ContractRow contract={{ ...contract, areaRank: 1 }} onOpen={() => undefined} />);
    expect(screen.getByText('Twój poziom')).toBeTruthy();
    expect(screen.queryByText('Ten obszar')).toBeNull();
  });
});
