import { http } from '../lib/http';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type BookingRequestSpeaker = ApiResponse<
  '/admin/booking-requests/{requestId}/speakers',
  'get'
>[number];
export type AddBookingRequestSpeakerBody = ApiRequestBody<
  '/admin/booking-requests/{requestId}/speakers',
  'post'
>;
export type UpdateBookingRequestSpeakerStatusBody = ApiRequestBody<
  '/admin/booking-requests/{requestId}/speakers/{speakerId}/status',
  'patch'
>;
export type ReorderBookingRequestSpeakersBody = ApiRequestBody<
  '/admin/booking-requests/{requestId}/speakers/reorder',
  'put'
>;
export type ReplaceBookingRequestSpeakerBody = ApiRequestBody<
  '/admin/booking-requests/{requestId}/speakers/{speakerId}/replace',
  'post'
>;

export async function fetchBookingRequestSpeakers(
  requestId: number,
): Promise<BookingRequestSpeaker[]> {
  const { data } = await http.get<BookingRequestSpeaker[]>(
    `/admin/booking-requests/${requestId}/speakers`,
  );
  return data;
}

export async function addBookingRequestSpeaker(
  requestId: number,
  body: AddBookingRequestSpeakerBody,
): Promise<BookingRequestSpeaker> {
  const { data } = await http.post<BookingRequestSpeaker>(
    `/admin/booking-requests/${requestId}/speakers`,
    body,
  );
  return data;
}

export async function removeBookingRequestSpeaker(
  requestId: number,
  speakerId: number,
): Promise<void> {
  await http.delete(`/admin/booking-requests/${requestId}/speakers/${speakerId}`);
}

export async function updateBookingRequestSpeakerStatus(
  requestId: number,
  speakerId: number,
  body: UpdateBookingRequestSpeakerStatusBody,
): Promise<BookingRequestSpeaker> {
  const { data } = await http.patch<BookingRequestSpeaker>(
    `/admin/booking-requests/${requestId}/speakers/${speakerId}/status`,
    body,
  );
  return data;
}

export async function reorderBookingRequestSpeakers(
  requestId: number,
  body: ReorderBookingRequestSpeakersBody,
): Promise<BookingRequestSpeaker[]> {
  const { data } = await http.put<BookingRequestSpeaker[]>(
    `/admin/booking-requests/${requestId}/speakers/reorder`,
    body,
  );
  return data;
}

export async function replaceBookingRequestSpeaker(
  requestId: number,
  speakerId: number,
  body: ReplaceBookingRequestSpeakerBody,
): Promise<BookingRequestSpeaker> {
  const { data } = await http.post<BookingRequestSpeaker>(
    `/admin/booking-requests/${requestId}/speakers/${speakerId}/replace`,
    body,
  );
  return data;
}
