// Wrappers typés au-dessus de `http` pour /admin/speakers/* — un seul
// endroit qui connaît la forme exacte des requêtes/réponses (voir
// types/api-helpers.ts), les vues n'appellent jamais axios directement.
import { http } from '../lib/http';
import type { ApiListResponse } from '../composables/useApiList';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type SpeakerListItem = ApiResponse<
  '/admin/speakers',
  'get'
>['data'][number];
export type SpeakerDetail = ApiResponse<'/admin/speakers/{id}', 'get'>;
export type CreateSpeakerBody = ApiRequestBody<'/admin/speakers', 'post'>;
export type UpdateSpeakerBody = ApiRequestBody<'/admin/speakers/{id}', 'patch'>;
export type UpdateSpeakerStatusBody = ApiRequestBody<
  '/admin/speakers/{id}/status',
  'patch'
>;
export type SpeakerStatus = SpeakerDetail['status'];

export interface SpeakersQuery {
  page: number;
  perPage: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  pillarId?: string;
  themeId?: string;
  countryId?: string;
  languageId?: string;
  formatId?: string;
  feeTierPublic?: string;
  status?: string;
  isFeaturedHome?: string;
  isTopRequested?: string;
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

export async function fetchSpeakers(
  query: SpeakersQuery,
): Promise<ApiListResponse<SpeakerListItem>> {
  const { data } = await http.get<ApiResponse<'/admin/speakers', 'get'>>(
    '/admin/speakers',
    {
      params: {
        page: query.page,
        perPage: query.perPage,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        search: query.search || undefined,
        pillarId: toNumberOrUndefined(query.pillarId),
        themeId: toNumberOrUndefined(query.themeId),
        countryId: toNumberOrUndefined(query.countryId),
        languageId: toNumberOrUndefined(query.languageId),
        formatId: toNumberOrUndefined(query.formatId),
        feeTierPublic: query.feeTierPublic || undefined,
        status: query.status || undefined,
        isFeaturedHome: toBoolOrUndefined(query.isFeaturedHome),
        isTopRequested: toBoolOrUndefined(query.isTopRequested),
      },
    },
  );
  return data;
}

export async function fetchSpeaker(id: number): Promise<SpeakerDetail> {
  const { data } = await http.get<SpeakerDetail>(`/admin/speakers/${id}`);
  return data;
}

export async function createSpeaker(
  body: CreateSpeakerBody,
): Promise<SpeakerDetail> {
  const { data } = await http.post<SpeakerDetail>('/admin/speakers', body);
  return data;
}

export async function updateSpeaker(
  id: number,
  body: UpdateSpeakerBody,
): Promise<SpeakerDetail> {
  const { data } = await http.patch<SpeakerDetail>(
    `/admin/speakers/${id}`,
    body,
  );
  return data;
}

export async function updateSpeakerStatus(
  id: number,
  body: UpdateSpeakerStatusBody,
): Promise<SpeakerDetail> {
  const { data } = await http.patch<SpeakerDetail>(
    `/admin/speakers/${id}/status`,
    body,
  );
  return data;
}

export async function deleteSpeaker(id: number): Promise<void> {
  await http.delete(`/admin/speakers/${id}`);
}

export type MediaUploadResult = ApiResponse<'/admin/media/upload', 'post'>;

export async function uploadPhoto(file: File): Promise<MediaUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<MediaUploadResult>(
    '/admin/media/upload',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}
