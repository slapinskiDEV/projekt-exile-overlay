import type { OverlayContract } from '@shared/api-types';
import { areaLabel, timeAgo } from '../lib/format';

export function ContractRow({
  contract,
  onOpen,
  extra,
}: {
  contract: OverlayContract;
  onOpen: (id: string) => void;
  extra?: string;
}) {
  const where = areaLabel(contract.area, contract.areaLevel);
  return (
    <button className="list-item" onClick={() => onOpen(contract.id)}>
      <div className="spread">
        <span className="badge">{contract.categoryLabel}</span>
        <span className="row">
          {contract.areaRank === 0 && <span className="badge green">Ten obszar</span>}
          {contract.areaRank === 1 && <span className="badge gold">Twój poziom</span>}
          {extra && <span className="badge gold">{extra}</span>}
        </span>
      </div>
      <div className="item-title">{contract.title}</div>
      <div className="meta">
        <span>{contract.issuer.name ?? 'Gracz'}</span>
        {where && <span>{where}</span>}
        <span>
          pomocnicy {contract.helpersCount}/{contract.maxHelpers}
        </span>
        <span className="rp">{contract.rpValue} RP</span>
        <span>{timeAgo(contract.createdAt)}</span>
      </div>
    </button>
  );
}
