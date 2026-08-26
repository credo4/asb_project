import { http } from '../lib/http';
import type { ApiListResponse } from '../composables/useApiList';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type RosterApplicationListItem = ApiResponse<
  '/admin/roster-applications',
  'get'
>['data'][number];
export type RosterApplicationDetail = ApiResponse<
  '/admin/roster-applications/{id}',
  'get'
>;
export type RosterApplicationHistoryEntry = ApiResponse<
  '/admin/roster-applications/{id}/history',
  'get'
>[number];
export type UpdateApplicationStatusBody = ApiRequestBody<
  '/admin/roster-applications/{id}/status',
  'patch'
>;
export type AssignApplicationBody = ApiRequestBody<
  '/admin/roster-applications/{id}/assign',
  'patch'
>;
export type ReopenApplicationBody = ApiRequestBody<
  '/admin/roster-applications/{id}/reopen',
  'patch'
>;
export type RequestInfoBody = ApiRequestBody<
  '/admin/roster-applications/{id}/request-info',
  'post'
>;
export type RejectApplicationBody = ApiRequestBody<
  '/admin/roster-applications/{id}/reject',
  'post'
>;
export type AttachExistingUserBody = ApiRequestBody<
  '/admin/roster-applications/{id}/attach-existing-user',
  'post'
>;
export type ConversionResult = ApiResponse<
  '/admin/roster-applications/{id}/convert',
  'post'
>;
export type UpsertEvaluationBody = ApiRequestBody<
  '/admin/roster-applications/{applicationId}/evaluations/me',
  'put'
>;
export type Evaluation = ApiResponse<
  '/admin/roster-applications/{applicationId}/evaluations/me',
  'put'
>;
export type ApplicationAttachment = RosterApplicationDetail['attachments'][number];

export interface RosterApplicationsQuery {
  page: number;
  perPage: number;
  status?: string;
  country?: string;
  assignedAdminId?: string;
  dateFrom?: string;
  dateTo?: string;
  minScore?: string;
  search?: string;
}

function toNumberOrUndefined(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function fetchRosterApplications(
  query: RosterApplicationsQuery,
): Promise<ApiListResponse<RosterApplicationListItem>> {
  const { data } = await http.get<
    ApiResponse<'/admin/roster-applications', 'get'>
  >('/admin/roster-applications', {
    params: {
      page: query.page,
      perPage: query.perPage,
      status: query.status || undefined,
      country: query.country || undefined,
      assignedAdminId: toNumberOrUndefined(query.assignedAdminId),
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined,
      minScore: toNumberOrUndefined(query.minScore),
      search: query.search || undefined,
    },
  });
  return data;
}

export async function fetchRosterApplication(
  id: number,
): Promise<RosterApplicationDetail> {
  const { data } = await http.get<RosterApplicationDetail>(
    `/admin/roster-applications/${id}`,
  );
  return data;
}

export async function fetchRosterApplicationHistory(
  id: number,
): Promise<RosterApplicationHistoryEntry[]> {
  const { data } = await http.get<RosterApplicationHistoryEntry[]>(
    `/admin/roster-applications/${id}/history`,
  );
  return data;
}

export async function updateApplicationStatus(
  id: number,
  body: UpdateApplicationStatusBody,
): Promise<RosterApplicationDetail> {
  const { data } = await http.patch<RosterApplicationDetail>(
    `/admin/roster-applications/${id}/status`,
    body,
  );
  return data;
}

export async function reopenApplication(
  id: number,
  body: ReopenApplicationBody,
): Promise<RosterApplicationDetail> {
  const { data } = await http.patch<RosterApplicationDetail>(
    `/admin/roster-applications/${id}/reopen`,
    body,
  );
  return data;
}

export async function assignApplication(
  id: number,
  body: AssignApplicationBody,
): Promise<RosterApplicationDetail> {
  const { data } = await http.patch<RosterApplicationDetail>(
    `/admin/roster-applications/${id}/assign`,
    body,
  );
  return data;
}

export async function requestApplicationInfo(
  id: number,
  body: RequestInfoBody,
): Promise<RosterApplicationDetail> {
  const { data } = await http.post<RosterApplicationDetail>(
    `/admin/roster-applications/${id}/request-info`,
    body,
  );
  return data;
}

export async function rejectApplication(
  id: number,
  body: RejectApplicationBody,
): Promise<RosterApplicationDetail> {
  const { data } = await http.post<RosterApplicationDetail>(
    `/admin/roster-applications/${id}/reject`,
    body,
  );
  return data;
}

export async function convertApplication(
  id: number,
): Promise<ConversionResult> {
  const { data } = await http.post<ConversionResult>(
    `/admin/roster-applications/${id}/convert`,
  );
  return data;
}

export async function attachExistingUser(
  id: number,
  body: AttachExistingUserBody,
): Promise<ConversionResult> {
  const { data } = await http.post<ConversionResult>(
    `/admin/roster-applications/${id}/attach-existing-user`,
    body,
  );
  return data;
}

export async function resendInvitation(id: number): Promise<void> {
  await http.post(`/admin/roster-applications/${id}/resend-invitation`);
}

export async function upsertOwnEvaluation(
  applicationId: number,
  body: UpsertEvaluationBody,
): Promise<Evaluation> {
  const { data } = await http.put<Evaluation>(
    `/admin/roster-applications/${applicationId}/evaluations/me`,
    body,
  );
  return data;
}

export async function uploadApplicationAttachment(
  applicationId: number,
  file: File,
): Promise<ApplicationAttachment> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<ApplicationAttachment>(
    `/admin/roster-applications/${applicationId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function deleteApplicationAttachment(
  applicationId: number,
  attachmentId: number,
): Promise<void> {
  await http.delete(
    `/admin/roster-applications/${applicationId}/attachments/${attachmentId}`,
  );
}

export async function createApplicationAttachmentDownloadLink(
  applicationId: number,
  attachmentId: number,
): Promise<{ url: string; expiresAt: string }> {
  const { data } = await http.get<{ url: string; expiresAt: string }>(
    `/admin/roster-applications/${applicationId}/attachments/${attachmentId}/download-link`,
  );
  return data;
}
