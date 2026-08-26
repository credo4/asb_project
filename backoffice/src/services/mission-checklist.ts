import { http } from '../lib/http';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type MissionChecklistItem = ApiResponse<
  '/admin/missions/{missionId}/checklist',
  'post'
>;
export type ToggleChecklistItemBody = ApiRequestBody<
  '/admin/missions/{missionId}/checklist/{itemId}',
  'patch'
>;
export type AddChecklistItemBody = ApiRequestBody<
  '/admin/missions/{missionId}/checklist',
  'post'
>;

export async function toggleChecklistItem(
  missionId: number,
  itemId: number,
  body: ToggleChecklistItemBody,
): Promise<MissionChecklistItem> {
  const { data } = await http.patch<MissionChecklistItem>(
    `/admin/missions/${missionId}/checklist/${itemId}`,
    body,
  );
  return data;
}

export async function addChecklistItem(
  missionId: number,
  body: AddChecklistItemBody,
): Promise<MissionChecklistItem> {
  const { data } = await http.post<MissionChecklistItem>(
    `/admin/missions/${missionId}/checklist`,
    body,
  );
  return data;
}
