/**
 * Kontrakt API overlaya (spec 0159). Plik jest kopiowany 1:1 do repozytorium
 * `projekt-exile-overlay` (`src/shared/api-types.ts`) — zmiana tutaj wymaga zmiany
 * tam. Nie importuje niczego.
 *
 * Wszystkie trasy: `https://projektexile.pl/api/overlay/...`
 * Nagłówki: `X-Overlay-Version: 0.1.0` (zawsze), `Authorization: Bearer pex_…`
 * (po sparowaniu). Błąd ma zawsze kształt `OverlayError`.
 *
 * | Metoda | Ścieżka                               | Konto | Opis                              |
 * | ------ | ------------------------------------- | ----- | --------------------------------- |
 * | GET    | /version                              | nie   | minimalna wersja overlaya         |
 * | GET    | /leagues                              | nie   | ligi PoE 2                        |
 * | GET    | /categories                           | nie   | kategorie kontraktów              |
 * | POST   | /pair                                 | nie   | kod z profilu → token urządzenia  |
 * | GET    | /contracts?league=&category=&area=&areaLevel= | nie | otwarte prośby (podgląd)  |
 * | GET    | /contracts/:id                        | nie   | szczegóły, zgłoszenia, rozmowa    |
 * | POST   | /contracts                            | tak   | nowa prośba                       |
 * | POST   | /contracts/:id/apply                  | tak   | „Pomogę”                          |
 * | POST   | /contracts/:id/messages               | tak   | wiadomość w rozmowie              |
 * | POST   | /contracts/:id/extend                 | tak   | „Przedłuż”                        |
 * | POST   | /contracts/:id/close                  | tak   | „Zamknij”                         |
 * | POST   | /contracts/:id/finish                 | tak   | zakończ, przyznaj RP pomocnikom   |
 * | POST   | /applications/:id/accept              | tak   | przyjmij pomocnika                |
 * | POST   | /applications/:id/withdraw            | tak   | wycofaj swoje zgłoszenie          |
 * | GET    | /threads?league=                      | nie   | pytania w dziale Pomoc            |
 * | GET    | /threads/:id                          | nie   | pytanie z odpowiedziami           |
 * | POST   | /threads                              | tak   | „Zapytaj społeczność”             |
 * | POST   | /threads/:id/posts                    | tak   | odpowiedź                         |
 * | GET    | /me                                   | tak   | profil, moje kontrakty            |
 * | GET    | /notifications                        | tak   | ostatnie powiadomienia            |
 * | POST   | /notifications/read                   | tak   | oznacz jako przeczytane           |
 * | GET    | /realtime                             | tak   | krótkotrwały token do Realtime    |
 * | DELETE | /device                               | tak   | rozłącz to urządzenie             |
 */

export interface OverlayError {
  error: string;
  /** Komunikat po polsku, gotowy do pokazania graczowi. */
  message: string;
  /** Przy `update_required`. */
  minVersion?: string;
}

export interface VersionResponse {
  minVersion: string;
}

export interface LeaguesResponse {
  leagues: Array<{ id: string; name: string }>;
}

export interface CategoriesResponse {
  categories: Array<{ id: string; label: string }>;
}

export interface PairRequest {
  code: string;
  deviceName?: string;
}

export interface PairResponse {
  token: string;
  user: OverlayProfile;
}

export interface OverlayProfile {
  id: string;
  displayName: string | null;
  level: number;
  reputation: number;
}

export type ContractStatus =
  | 'open'
  | 'taken'
  | 'in_progress'
  | 'completed'
  | 'community_review'
  | 'verified'
  | 'rejected'
  | 'disputed'
  | 'cancelled'
  | 'expired';

export interface OverlayContract {
  id: string;
  title: string;
  description: string;
  status: ContractStatus;
  contractType: 'individual' | 'community';
  categoryId: string;
  categoryLabel: string;
  league: string | null;
  area: string | null;
  areaLevel: number | null;
  rpValue: number;
  helpersCount: number;
  maxHelpers: number;
  issuer: { id: string; name: string | null };
  createdAt: string;
  /** 0 — ten sam obszar, 1 — poziom ±5, 2 — reszta. */
  areaRank: 0 | 1 | 2;
}

export interface ContractsResponse {
  contracts: OverlayContract[];
}

export interface OverlayApplication {
  id: string;
  applicantId: string;
  applicantName: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  message: string | null;
  createdAt: string;
}

export interface OverlayMessage {
  id: string;
  authorId: string;
  authorName: string | null;
  content: string;
  createdAt: string;
}

export interface ContractDetailResponse {
  contract: OverlayContract & {
    itemText: string | null;
    contractorId: string | null;
    expiryWarnedAt: string | null;
  };
  applications: OverlayApplication[];
  messages: OverlayMessage[];
}

export interface CreateContractRequest {
  categoryId: string;
  /** Jedno zdanie od gracza — z niego powstaje tytuł i opis. */
  text: string;
  league?: string | null;
  area?: string | null;
  areaLevel?: number | null;
  itemText?: string | null;
  contractType?: 'individual' | 'community';
}

export interface CreatedResponse {
  id: string;
}

export interface FinishContractRequest {
  helperIds: string[];
}

export interface OverlayThread {
  id: string;
  title: string;
  authorName: string | null;
  createdAt: string;
  url: string;
}

export interface ThreadsResponse {
  threads: OverlayThread[];
}

export interface ThreadDetailResponse {
  thread: OverlayThread & { content: string };
  posts: Array<{
    id: string;
    authorName: string | null;
    content: string;
    createdAt: string;
  }>;
}

export interface CreateThreadRequest {
  title: string;
  content: string;
  league?: string | null;
}

export interface MeResponse {
  profile: OverlayProfile;
  /** Moje otwarte prośby i te, w których pomagam. */
  contracts: Array<OverlayContract & { role: 'issuer' | 'helper' | 'applicant' }>;
}

export interface OverlayNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  url: string;
  isRead: boolean;
  createdAt: string;
  contractId: string | null;
}

export interface NotificationsResponse {
  notifications: OverlayNotification[];
}

export interface RealtimeResponse {
  url: string;
  publishableKey: string;
  accessToken: string;
  expiresAt: string;
  userId: string;
}
