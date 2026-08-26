// Paramètres > Général (§A4). Lecture ADMIN, écriture SUPER_ADMIN.
import { http } from '../lib/http';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type AppSettings = ApiResponse<'/admin/settings', 'get'>;
export type UpdateAppSettingsBody = ApiRequestBody<
  '/admin/settings',
  'patch'
>;

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data } = await http.get<AppSettings>('/admin/settings');
  return data;
}

export async function updateAppSettings(
  body: UpdateAppSettingsBody,
): Promise<AppSettings> {
  const { data } = await http.patch<AppSettings>('/admin/settings', body);
  return data;
}
