// Paramètres > Sécurité (§A3). Réservé SUPER_ADMIN côté API.
import { http } from '../lib/http';
import type { ApiListResponse } from '../composables/useApiList';
import type { ApiResponse } from '../types/api-helpers';

export type LoginEventItem = ApiResponse<
  '/admin/login-events',
  'get'
>['data'][number];

export interface LoginEventsQuery {
  page: number;
  perPage: number;
  success?: string;
  email?: string;
  dateFrom?: string;
  dateTo?: string;
}

function toBoolOrUndefined(value?: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function fetchLoginEvents(
  query: LoginEventsQuery,
): Promise<ApiListResponse<LoginEventItem>> {
  const { data } = await http.get<ApiResponse<'/admin/login-events', 'get'>>(
    '/admin/login-events',
    {
      params: {
        page: query.page,
        perPage: query.perPage,
        success: toBoolOrUndefined(query.success),
        email: query.email || undefined,
        dateFrom: query.dateFrom || undefined,
        dateTo: query.dateTo || undefined,
      },
    },
  );
  return data;
}
