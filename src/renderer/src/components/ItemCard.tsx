import { useMemo, useState } from 'react';
import { RARITY_COLORS, modifierKind, parseItemText } from '@shared/poe-item';

/**
 * Karta przedmiotu — ten sam wygląd co na stronie: nazwa w kolorze rzadkości,
 * podstawa, sekcje rozdzielone kreską i przycisk „Kopiuj tekst”.
 */
export function ItemCard({ text, onCopy }: { text: string; onCopy?: (text: string) => Promise<void> }) {
  const item = useMemo(() => parseItemText(text), [text]);
  const [copied, setCopied] = useState(false);
  const color = item ? RARITY_COLORS[item.rarity] : RARITY_COLORS.other;

  const copy = async () => {
    try {
      await (onCopy ? onCopy(text) : navigator.clipboard.writeText(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Brak dostępu do schowka — tekst i tak da się zaznaczyć.
    }
  };

  return (
    <div className="item-card" style={{ borderColor: `${color}88` }} data-item-rarity={item?.rarity ?? 'unknown'}>
      <button type="button" className="copy" onClick={copy}>
        {copied ? 'Skopiowano' : 'Kopiuj tekst'}
      </button>
      {item ? (
        <>
          <div className="head" style={{ borderColor: `${color}55`, backgroundColor: `${color}14` }}>
            {item.name && (
              <div className="name" style={{ color }}>
                {item.name}
              </div>
            )}
            {item.baseType && (
              <div className="base" style={{ color }}>
                {item.baseType}
              </div>
            )}
            {item.itemClass && <div className="class">{item.itemClass}</div>}
          </div>
          {item.sections.map((section, index) => (
            <div key={index} className="sect">
              {section.map((line, lineIndex) => (
                <div key={lineIndex} className={`line ${modifierKind(line)}`}>
                  {line}
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        <pre>{text}</pre>
      )}
    </div>
  );
}
