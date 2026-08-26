// Tableau de bord (§4.2) — AUCUN endpoint d'agrégation n'existe côté API
// (voir backend/src/modules/analytics/admin-analytics.controller.ts :
// "aucune agrégation, aucun tableau de bord ici — Phase 4" -- qui n'est pas
// encore construite côté backend). Les indicateurs ci-dessous sont donc
// composés à partir des `meta.total` des listes existantes, déjà filtrées
// côté serveur (perPage=1 : on ne veut que le total, pas les lignes) --
// des comptages RÉELS, jamais une valeur inventée ou simulée. Si un
// indicateur n'est pas dérivable ainsi, il n'apparaît pas ici.
import { http } from '../lib/http';

interface CountResponse {
  meta: { total: number };
}

async function count(url: string, params: Record<string, string>): Promise<number> {
  const { data } = await http.get<CountResponse>(url, {
    params: { ...params, page: 1, perPage: 1 },
  });
  return data.meta.total;
}

export interface DashboardCounts {
  speakersTotal: number;
  speakersPublished: number;
  speakersPendingValidation: number;
  revisionsSubmitted: number;
  bookingRequestsTotal: number;
  bookingRequestsNew: number;
  bookingRequestsOverdue: number;
  applicationsTotal: number;
  applicationsNew: number;
}

export async function fetchDashboardCounts(): Promise<DashboardCounts> {
  const [
    speakersTotal,
    speakersPublished,
    speakersPendingValidation,
    revisionsSubmitted,
    bookingRequestsTotal,
    bookingRequestsNew,
    bookingRequestsOverdue,
    applicationsTotal,
    applicationsNew,
  ] = await Promise.all([
    count('/admin/speakers', {}),
    count('/admin/speakers', { status: 'PUBLISHED' }),
    count('/admin/speakers', { status: 'PENDING_VALIDATION' }),
    count('/admin/speaker-revisions', { status: 'SUBMITTED' }),
    count('/admin/booking-requests', {}),
    count('/admin/booking-requests', { status: 'NEW' }),
    count('/admin/booking-requests', { overdue: 'true' }),
    count('/admin/roster-applications', {}),
    count('/admin/roster-applications', { status: 'NEW' }),
  ]);
  return {
    speakersTotal,
    speakersPublished,
    speakersPendingValidation,
    revisionsSubmitted,
    bookingRequestsTotal,
    bookingRequestsNew,
    bookingRequestsOverdue,
    applicationsTotal,
    applicationsNew,
  };
}
