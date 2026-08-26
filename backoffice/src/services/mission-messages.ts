import { http } from '../lib/http';
import type { ApiRequestBody } from '../types/api-helpers';
import type { MissionDetail } from './missions';

export type MissionMessage = MissionDetail['messages'][number];
export type CreateMissionMessageBody = ApiRequestBody<
  '/admin/missions/{missionId}/messages',
  'post'
>;

export async function createMissionMessage(
  missionId: number,
  body: CreateMissionMessageBody,
): Promise<MissionMessage> {
  const { data } = await http.post<MissionMessage>(
    `/admin/missions/${missionId}/messages`,
    body,
  );
  return data;
}
