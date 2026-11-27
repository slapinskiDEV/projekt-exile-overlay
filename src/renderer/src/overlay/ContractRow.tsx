import type { OverlayContract } from '@shared/api-types';
import { areaLabel, timeAgo } from '../lib/format';
import { PaymentChip } from '../components/Payment';

/**
 * Karta kontraktu na liście (0.3.7): najpierw tytuł, pod nim jedna szara linijka
 * „gdzie · kto · kiedy”; po prawej tylko liczby. Rodzaj widać po kolorze paska
 * (złoty — prośba, zielony — oferta), bez stosu plakietek.
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
    <button
      className={`list-item card-row ${offer ? 'offer' : 'request'}`}
      onClick={() => onOpen(contract.id)}
      aria-label={`${offer ? 'Oferta' : 'Prośba'}: ${contract.title}`}
    >
      <div className="card-main">
        <div className="item-title">{contract.title}</div>
        <div className="card-sub">
          <span className="card-category">{contract.categoryLabel}</span>
          {contract.areaRank === 0 && <span className="here">● Ten obszar</span>}
          {contract.areaRank === 1 && <span className="near">Twój poziom</span>}
          {where && contract.areaRank !== 0 && <span>📍 {where}</span>}
        </div>
        <div className="card-sub muted">
          {contract.issuer.name ?? 'Gracz'} · {timeAgo(contract.createdAt)}
          {extra && <span className="card-extra"> · {extra}</span>}
        </div>
      </div>
      <div className="card-side">
        <span className="side-rp">
          {contract.rpValue}
          <small> RP</small>
        </span>
        <span className={`side-slots ${full ? 'full' : ''}`}>
          {contract.helpersCount}/{contract.maxHelpers} <small>{offer ? 'miejsca' : 'pomocników'}</small>
        </span>
        {contract.payment && <PaymentChip payment={contract.payment} />}
      </div>
    </button>
  );
}
