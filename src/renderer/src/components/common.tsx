import type { ReactNode } from 'react';
import { GGG_DISCLAIMER, RELEASES_URL } from '@shared/ipc';
import logo from '../assets/logo.png';

export { logo };

/** Ekran blokujący: API odrzuca tę wersję overlaya. */
export function UpdateRequired({ minVersion, version }: { minVersion: string; version: string }) {
  return (
    <div className="blocking stack">
      <h2>Zaktualizuj overlay</h2>
      <p>
        Ta wersja ({version}) nie jest już obsługiwana. Minimalna wersja to {minVersion}. Do czasu aktualizacji
        overlay nie wysyła ani nie zapisuje żadnych danych.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="primary" onClick={() => void window.overlay.checkForUpdates()}>
          Sprawdź aktualizacje
        </button>
        <button onClick={() => void window.overlay.openExternal(RELEASES_URL)}>Strona wydań</button>
      </div>
    </div>
  );
}

/** Co overlay czyta i wysyła — ekran pierwszego uruchomienia i „O aplikacji”. */
export function PrivacyInfo() {
  return (
    <>
      <ul className="bullets">
        <li>
          Overlay czyta <strong>plik logu gry</strong> (<code>Client.txt</code>): nazwę i poziom obszaru, w którym
          jesteś, oraz podpowiedź nicku postaci z czatu lokalnego.
        </li>
        <li>
          <strong>Schowek</strong> czyta tylko po naciśnięciu skrótu „Zapytaj o przedmiot” (domyślnie Alt+C) —
          wtedy wysyła do gry jedno Ctrl+C i raz odczytuje schowek.
        </li>
        <li>
          Na serwer Projekt Exile trafia <strong>tylko to, co sam wyślesz formularzem</strong>, oraz nazwa i
          poziom obszaru dołączone do prośby.
        </li>
        <li>
          Overlay <strong>nie czyta pamięci gry</strong>, nie wstrzykuje kodu i niczego nie robi automatycznie:
          jedno naciśnięcie skrótu to najwyżej jedna akcja w grze.
        </li>
      </ul>
      <p className="disclaimer">{GGG_DISCLAIMER}</p>
    </>
  );
}

export function Brand({ children }: { children?: ReactNode }) {
  return (
    <div className="brand">
      <img src={logo} alt="" />
      <span>Projekt Exile Overlay</span>
      {children}
    </div>
  );
}

/** Informacja dla trybu „Tylko podgląd” przy każdej akcji zapisu. */
export function LoginRequired() {
  return (
    <div className="card stack">
      <p>Zaloguj się, żeby pomóc albo poprosić.</p>
      <p className="muted small">
        Połącz overlay z kontem Projekt Exile kodem z ustawień profilu na stronie.
      </p>
      <button className="primary" onClick={() => void window.overlay.openSettings()}>
        Połącz konto
      </button>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="error">{children}</p>;
}
