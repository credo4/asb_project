// Rapports et statistiques (ligne 5.13, Partie B) — voir CLAUDE.md.
import { http } from '../lib/http';
import type { ApiResponse } from '../types/api-helpers';

export type SpeakersReport = ApiResponse<'/admin/reports/speakers', 'get'>;
export type CommercialReport = ApiResponse<'/admin/reports/commercial', 'get'>;
export type EditorialReport = ApiResponse<'/admin/reports/editorial', 'get'>;
export type SpeakerMetric = SpeakersReport['speakers'][number];

export interface ReportPeriodParams {
  from: string;
  to: string;
}

export async function fetchSpeakersReport(
  params: ReportPeriodParams & { page?: number; perPage?: number },
): Promise<SpeakersReport> {
  const { data } = await http.get<SpeakersReport>('/admin/reports/speakers', {
    params,
  });
  return data;
}

export async function fetchCommercialReport(
  params: ReportPeriodParams,
): Promise<CommercialReport> {
  const { data } = await http.get<CommercialReport>(
    '/admin/reports/commercial',
    { params },
  );
  return data;
}

export async function fetchEditorialReport(
  params: ReportPeriodParams,
): Promise<EditorialReport> {
  const { data } = await http.get<EditorialReport>(
    '/admin/reports/editorial',
    { params },
  );
  return data;
}

export type ReportName = 'speakers' | 'commercial' | 'editorial';

// §A6 — export CSV. `table` choisit le tableau du rapport à exporter (voir
// reports-csv.util.ts côté API) ; omis, l'API retombe sur un défaut sensé
// par rapport. Authentifié (contrairement au lien signé des documents de
// mission/speaker) : passe par `http` (le header Authorization est posé par
// l'intercepteur), `responseType: 'blob'` pour récupérer le corps texte tel
// quel plutôt que de le laisser parser en JSON.
export async function downloadReportCsv(
  report: ReportName,
  params: ReportPeriodParams,
  table?: string,
): Promise<void> {
  const response = await http.get<Blob>(`/admin/reports/${report}`, {
    params: { ...params, format: 'csv', table },
    responseType: 'blob',
  });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `rapport-${report}${table ? `-${table}` : ''}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
