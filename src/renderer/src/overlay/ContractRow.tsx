import type { OverlayContract } from '@shared/api-types';
import { areaLabel, timeAgo } from '../lib/format';
import { PaymentChip } from '../components/Payment';

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
  const offer = contract.kind === 'offer';
  const full = contract.helpersCount >= contract.maxHelpers;
  return (
    <button className={`list-item ${offer ? 'offer' : 'request'}`} onClick={() => onOpen(contract.id)}>
      <div className="spread">
        <span className="row tight">
          <span className={`kind-tag ${offer ? 'offer' : 'request'}`}>{offer ? 'Oferta' : 'Prośba'}</span>
          <span className="badge">{contract.categoryLabel}</span>
        </span>
        <span className="row tight">
          {contract.areaRank === 0 && <span className="badge green">Ten obszar</span>}
          {contract.areaRank === 1 && <span className="badge gold">Twój poziom</span>}
          {extra && <span className="badge gold">{extra}</span>}
        </span>
      </div>
      <div className="item-title">{contract.title}</div>
      {where && (
        <div className="where">
          <span aria-hidden>📍</span> <span>{where}</span>
        </div>
      )}
      <div className="meta">
        <span>{contract.issuer.name ?? 'Gracz'}</span>
        <span className={full ? 'full' : ''}>
          {offer ? 'miejsca' : 'pomocnicy'} {contract.helpersCount}/{contract.maxHelpers}
        </span>
        <span>{timeAgo(contract.createdAt)}</span>
        <span className="rp">{contract.rpValue} RP</span>
      </div>
      {contract.payment && (
        <div className="meta">
          <PaymentChip payment={contract.payment} />
          <span>od osoby</span>
        </div>
      )}
    </button>
  );
}
