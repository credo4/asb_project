import { http } from '../lib/http';
import type { ApiListResponse } from '../composables/useApiList';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type MissionListItem = ApiResponse<'/admin/missions', 'get'>['data'][number];
export type MissionDetail = ApiResponse<'/admin/missions/{id}', 'get'>;
export type MissionHistoryEntry = ApiResponse<
  '/admin/missions/{id}/history',
  'get'
>[number];
export type CreateMissionBody = ApiRequestBody<
  '/admin/booking-requests/{requestId}/missions',
  'post'
>;
export type UpdateMissionStatusBody = ApiRequestBody<
  '/admin/missions/{id}/status',
  'patch'
>;

export interface MissionsQuery {
  page: number;
  perPage: number;
  status?: string;
  contractStatus?: string;
  paymentStatus?: string;
  speakerId?: string;
  organizationId?: string;
  dateFrom?: string;
  dateTo?: string;
  upcoming?: string;
  past?: string;
}

function toNumberOrUndefined(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
function toBoolOrUndefined(value?: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function fetchMissions(
  query: MissionsQuery,
): Promise<ApiListResponse<MissionListItem>> {
  const { data } = await http.get<ApiResponse<'/admin/missions', 'get'>>(
    '/admin/missions',
    {
      params: {
        page: query.page,
        perPage: query.perPage,
        status: query.status || undefined,
        contractStatus: query.contractStatus || undefined,
        paymentStatus: query.paymentStatus || undefined,
        speakerId: toNumberOrUndefined(query.speakerId),
        organizationId: toNumberOrUndefined(query.organizationId),
        dateFrom: query.dateFrom || undefined,
        dateTo: query.dateTo || undefined,
        upcoming: toBoolOrUndefined(query.upcoming),
        past: toBoolOrUndefined(query.past),
      },
    },
  );
  return data;
}

export async function fetchMission(id: number): Promise<MissionDetail> {
  const { data } = await http.get<MissionDetail>(`/admin/missions/${id}`);
  return data;
}

export async function fetchMissionHistory(
  id: number,
): Promise<MissionHistoryEntry[]> {
  const { data } = await http.get<MissionHistoryEntry[]>(
    `/admin/missions/${id}/history`,
  );
  return data;
}

export async function createMission(
  requestId: number,
  body: CreateMissionBody,
): Promise<MissionDetail> {
  const { data } = await http.post<MissionDetail>(
    `/admin/booking-requests/${requestId}/missions`,
    body,
  );
  return data;
}

export async function updateMissionStatus(
  id: number,
  body: UpdateMissionStatusBody,
): Promise<MissionDetail> {
  const { data } = await http.patch<MissionDetail>(
    `/admin/missions/${id}/status`,
    body,
  );
  return data;
}
