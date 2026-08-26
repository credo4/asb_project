import { http } from '../lib/http';
import type { ApiListResponse } from '../composables/useApiList';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type BookingRequestListItem = ApiResponse<
  '/admin/booking-requests',
  'get'
>['data'][number];
export type BookingRequestDetail = ApiResponse<
  '/admin/booking-requests/{id}',
  'get'
>;
export type BookingRequestHistoryEntry = ApiResponse<
  '/admin/booking-requests/{id}/history',
  'get'
>[number];
export type UpdateBookingRequestStatusBody = ApiRequestBody<
  '/admin/booking-requests/{id}/status',
  'patch'
>;
export type AssignBookingRequestBody = ApiRequestBody<
  '/admin/booking-requests/{id}/assign',
  'patch'
>;
export type ReopenBookingRequestBody = ApiRequestBody<
  '/admin/booking-requests/{id}/reopen',
  'patch'
>;
export type UpdateBookingRequestBody = ApiRequestBody<
  '/admin/booking-requests/{id}',
  'patch'
>;
export type LinkBookingRequestBody = ApiRequestBody<
  '/admin/booking-requests/{id}/link',
  'patch'
>;
export type BookingRequestNote = BookingRequestDetail['notes'][number];
export type BookingRequestAttachment =
  BookingRequestDetail['attachments'][number];

export interface BookingRequestsQuery {
  page: number;
  perPage: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  serviceType?: string;
  status?: string;
  priority?: string;
  assignedAdminId?: string;
  organizationId?: string;
  overdue?: string;
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

export async function fetchBookingRequests(
  query: BookingRequestsQuery,
): Promise<ApiListResponse<BookingRequestListItem>> {
  const { data } = await http.get<
    ApiResponse<'/admin/booking-requests', 'get'>
  >('/admin/booking-requests', {
    params: {
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      search: query.search || undefined,
      serviceType: query.serviceType || undefined,
      status: query.status || undefined,
      priority: query.priority || undefined,
      assignedAdminId: toNumberOrUndefined(query.assignedAdminId),
      organizationId: toNumberOrUndefined(query.organizationId),
      overdue: toBoolOrUndefined(query.overdue),
    },
  });
  return data;
}

export async function fetchBookingRequest(
  id: number,
): Promise<BookingRequestDetail> {
  const { data } = await http.get<BookingRequestDetail>(
    `/admin/booking-requests/${id}`,
  );
  return data;
}

export async function fetchBookingRequestHistory(
  id: number,
): Promise<BookingRequestHistoryEntry[]> {
  const { data } = await http.get<BookingRequestHistoryEntry[]>(
    `/admin/booking-requests/${id}/history`,
  );
  return data;
}

export async function updateBookingRequest(
  id: number,
  body: UpdateBookingRequestBody,
): Promise<BookingRequestDetail> {
  const { data } = await http.patch<BookingRequestDetail>(
    `/admin/booking-requests/${id}`,
    body,
  );
  return data;
}

export async function updateBookingRequestStatus(
  id: number,
  body: UpdateBookingRequestStatusBody,
): Promise<BookingRequestDetail> {
  const { data } = await http.patch<BookingRequestDetail>(
    `/admin/booking-requests/${id}/status`,
    body,
  );
  return data;
}

export async function reopenBookingRequest(
  id: number,
  body: ReopenBookingRequestBody,
): Promise<BookingRequestDetail> {
  const { data } = await http.patch<BookingRequestDetail>(
    `/admin/booking-requests/${id}/reopen`,
    body,
  );
  return data;
}

export async function assignBookingRequest(
  id: number,
  body: AssignBookingRequestBody,
): Promise<BookingRequestDetail> {
  const { data } = await http.patch<BookingRequestDetail>(
    `/admin/booking-requests/${id}/assign`,
    body,
  );
  return data;
}

// Rattachement CRM (module Clients, ligne 5.12) -- voir CLAUDE.md §5 :
// convertit/rattache les données d'intake IMMUABLES ci-dessus vers une fiche
// Contact/Organization séparée, sans jamais les réécrire.
export async function linkBookingRequest(
  id: number,
  body: LinkBookingRequestBody,
): Promise<BookingRequestDetail> {
  const { data } = await http.patch<BookingRequestDetail>(
    `/admin/booking-requests/${id}/link`,
    body,
  );
  return data;
}

export async function createBookingRequestNote(
  requestId: number,
  body: string,
): Promise<BookingRequestNote> {
  const { data } = await http.post<BookingRequestNote>(
    `/admin/booking-requests/${requestId}/notes`,
    { body },
  );
  return data;
}

export async function deleteBookingRequestNote(
  requestId: number,
  noteId: number,
): Promise<void> {
  await http.delete(`/admin/booking-requests/${requestId}/notes/${noteId}`);
}

export async function uploadBookingRequestAttachment(
  requestId: number,
  file: File,
): Promise<BookingRequestAttachment> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<BookingRequestAttachment>(
    `/admin/booking-requests/${requestId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function deleteBookingRequestAttachment(
  requestId: number,
  attachmentId: number,
): Promise<void> {
  await http.delete(
    `/admin/booking-requests/${requestId}/attachments/${attachmentId}`,
  );
}

export async function createAttachmentDownloadLink(
  requestId: number,
  attachmentId: number,
): Promise<{ url: string; expiresAt: string }> {
  const { data } = await http.get<{ url: string; expiresAt: string }>(
    `/admin/booking-requests/${requestId}/attachments/${attachmentId}/download-link`,
  );
  return data;
}
