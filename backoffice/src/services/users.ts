// Paramètres > Utilisateurs (§28, ligne 5.13). Lecture ADMIN, écriture
// SUPER_ADMIN (déjà appliqué côté API — voir aussi config/user-status.ts
// et les garde-fous répliqués côté UI dans SettingsUsersPanel.vue).
import { http } from '../lib/http';
import type { ApiListResponse } from '../composables/useApiList';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type UserListItem = ApiResponse<'/admin/users', 'get'>['data'][number];
export type UserDetail = ApiResponse<'/admin/users/{id}', 'get'>;
export type CreateUserInviteBody = ApiRequestBody<'/admin/users', 'post'>;
export type UpdateUserBody = ApiRequestBody<'/admin/users/{id}', 'patch'>;
export type DeactivateUserBody = ApiRequestBody<
  '/admin/users/{id}/deactivate',
  'post'
>;
export type InviteUserResult = ApiResponse<'/admin/users', 'post'>;

export interface UsersQuery {
  page: number;
  perPage: number;
  search?: string;
  role?: string;
  status?: string;
}

export async function fetchUsers(
  query: UsersQuery,
): Promise<ApiListResponse<UserListItem>> {
  const { data } = await http.get<ApiResponse<'/admin/users', 'get'>>(
    '/admin/users',
    {
      params: {
        page: query.page,
        perPage: query.perPage,
        search: query.search || undefined,
        role: query.role || undefined,
        status: query.status || undefined,
      },
    },
  );
  return data;
}

// Utilisée par SettingsUsersPanel pour connaître le nombre RÉEL de
// SUPER_ADMIN actifs (indépendamment de la pagination/des filtres de la
// liste affichée) — reflète exactement le garde-fou §A1 côté API
// (UsersService#assertNotLastActiveSuperAdmin).
export async function countActiveSuperAdmins(): Promise<number> {
  const { data } = await http.get<ApiResponse<'/admin/users', 'get'>>(
    '/admin/users',
    { params: { page: 1, perPage: 1, role: 'SUPER_ADMIN', status: 'ACTIVE' } },
  );
  return data.meta.total;
}

export async function inviteUser(
  body: CreateUserInviteBody,
): Promise<InviteUserResult> {
  const { data } = await http.post<InviteUserResult>('/admin/users', body);
  return data;
}

export async function updateUser(
  id: number,
  body: UpdateUserBody,
): Promise<UserDetail> {
  const { data } = await http.patch<UserDetail>(`/admin/users/${id}`, body);
  return data;
}

export async function deactivateUser(
  id: number,
  body: DeactivateUserBody,
): Promise<UserDetail> {
  const { data } = await http.post<UserDetail>(
    `/admin/users/${id}/deactivate`,
    body,
  );
  return data;
}
