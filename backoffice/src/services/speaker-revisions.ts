import { http } from '../lib/http';
import type { ApiListResponse } from '../composables/useApiList';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type RevisionListItem = ApiResponse<
  '/admin/speaker-revisions',
  'get'
>['data'][number];
export type RevisionDetail = ApiResponse<'/admin/speaker-revisions/{id}', 'get'>;
export type RequestChangesBody = ApiRequestBody<
  '/admin/speaker-revisions/{id}/request-changes',
  'post'
>;
export type RejectRevisionBody = ApiRequestBody<
  '/admin/speaker-revisions/{id}/reject',
  'post'
>;

export interface RevisionsQuery {
  page: number;
  perPage: number;
  status?: string;
}

export async function fetchRevisions(
  query: RevisionsQuery,
): Promise<ApiListResponse<RevisionListItem>> {
  const { data } = await http.get<
    ApiResponse<'/admin/speaker-revisions', 'get'>
  >('/admin/speaker-revisions', {
    params: {
      page: query.page,
      perPage: query.perPage,
      status: query.status || undefined,
    },
  });
  return data;
}

export async function fetchRevision(id: number): Promise<RevisionDetail> {
  const { data } = await http.get<RevisionDetail>(
    `/admin/speaker-revisions/${id}`,
  );
  return data;
}

export async function approveRevision(id: number): Promise<RevisionDetail> {
  const { data } = await http.post<RevisionDetail>(
    `/admin/speaker-revisions/${id}/approve`,
  );
  return data;
}

export async function requestRevisionChanges(
  id: number,
  body: RequestChangesBody,
): Promise<RevisionDetail> {
  const { data } = await http.post<RevisionDetail>(
    `/admin/speaker-revisions/${id}/request-changes`,
    body,
  );
  return data;
}

export async function rejectRevision(
  id: number,
  body: RejectRevisionBody,
): Promise<RevisionDetail> {
  const { data } = await http.post<RevisionDetail>(
    `/admin/speaker-revisions/${id}/reject`,
    body,
  );
  return data;
}
