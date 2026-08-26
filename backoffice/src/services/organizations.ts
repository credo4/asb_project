// Module Clients (ligne 5.12 du planning) : consultation et rattachement
// uniquement -- pas de CRUD organisation en libre-service ici (créer une
// organisation ne se fait QUE via le rattachement depuis une demande,
// `createOrganizationFromIntake`, voir booking-requests.ts#linkBookingRequest).
import { http } from '../lib/http';
import type { ApiListResponse } from '../composables/useApiList';
import type { ApiResponse } from '../types/api-helpers';

export type OrganizationListItem = ApiResponse<
  '/admin/organizations',
  'get'
>['data'][number];
export type OrganizationDetail = ApiResponse<'/admin/organizations/{id}', 'get'>;
export type OrganizationSuggestion = ApiResponse<
  '/admin/organizations/suggest',
  'get'
>[number];

export interface OrganizationsQuery {
  page: number;
  perPage: number;
  search?: string;
  sector?: string;
  countryId?: string;
  assignedAdminId?: string;
}

function toNumberOrUndefined(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function fetchOrganizations(
  query: OrganizationsQuery,
): Promise<ApiListResponse<OrganizationListItem>> {
  const { data } = await http.get<ApiResponse<'/admin/organizations', 'get'>>(
    '/admin/organizations',
    {
      params: {
        page: query.page,
        perPage: query.perPage,
        search: query.search || undefined,
        sector: query.sector || undefined,
        countryId: toNumberOrUndefined(query.countryId),
        assignedAdminId: toNumberOrUndefined(query.assignedAdminId),
      },
    },
  );
  return data;
}

export async function fetchOrganization(id: number): Promise<OrganizationDetail> {
  const { data } = await http.get<OrganizationDetail>(`/admin/organizations/${id}`);
  return data;
}

export async function suggestOrganizations(
  name: string,
): Promise<OrganizationSuggestion[]> {
  if (name.trim().length < 2) return [];
  const { data } = await http.get<OrganizationSuggestion[]>(
    '/admin/organizations/suggest',
    { params: { name } },
  );
  return data;
}
