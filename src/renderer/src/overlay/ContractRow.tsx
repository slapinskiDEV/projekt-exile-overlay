import type { OverlayContract } from '@shared/api-types';
import { areaLabel, timeAgo } from '../lib/format';
import { PaymentChip } from '../components/Payment';

/**
 * Karta kontraktu na liście (0.3.6): po lewej co i gdzie, po prawej liczby, które
 * porównuje się między kartami — nagroda, miejsca, zapłata i dopasowanie do obszaru.
 */
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
    <button className={`list-item card-row ${offer ? 'offer' : 'request'}`} onClick={() => onOpen(contract.id)}>
      <div className="card-main">
        <span className="row tight">
          <span className={`kind-tag ${offer ? 'offer' : 'request'}`}>{offer ? 'Oferta' : 'Prośba'}</span>
          <span className="badge">{contract.categoryLabel}</span>
        </span>
        <div className="item-title">{contract.title}</div>
        {where && (
          <div className="where">
            <span aria-hidden>📍</span> <span>{where}</span>
          </div>
        )}
        <div className="meta">
          <span>{contract.issuer.name ?? 'Gracz'}</span>
          <span>{timeAgo(contract.createdAt)}</span>
        </div>
      </div>
      <div className="card-side">
        <span className="side-rp">
          {contract.rpValue}
          <small> RP</small>
        </span>
        <span className={`side-slots ${full ? 'full' : ''}`} title={offer ? 'Zajęte miejsca' : 'Pomocnicy'}>
          {offer ? 'miejsca' : 'pomocnicy'} {contract.helpersCount}/{contract.maxHelpers}
        </span>
        {contract.payment && <PaymentChip payment={contract.payment} />}
        {contract.areaRank === 0 && <span className="badge green">Ten obszar</span>}
        {contract.areaRank === 1 && <span className="badge gold">Twój poziom</span>}
        {extra && <span className="badge gold">{extra}</span>}
      </div>
    </button>
  );
}
