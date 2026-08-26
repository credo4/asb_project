import { http } from '../lib/http';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type AvailabilityRequestAdmin = ApiResponse<
  '/admin/availability-requests',
  'get'
>[number];
export type SendAvailabilityRequestBody = ApiRequestBody<
  '/admin/availability-requests',
  'post'
>;

export async function fetchAvailabilityRequestsForBooking(
  bookingRequestId: number,
): Promise<AvailabilityRequestAdmin[]> {
  const { data } = await http.get<AvailabilityRequestAdmin[]>(
    '/admin/availability-requests',
    { params: { bookingRequestId } },
  );
  return data;
}

export async function sendAvailabilityRequest(
  body: SendAvailabilityRequestBody,
): Promise<AvailabilityRequestAdmin> {
  const { data } = await http.post<AvailabilityRequestAdmin>(
    '/admin/availability-requests',
    body,
  );
  return data;
}
