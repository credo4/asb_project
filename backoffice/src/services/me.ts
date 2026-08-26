// Paramètres > Mon compte (§A2). Distinct du store d'auth (stores/auth.ts,
// qui gère uniquement l'état de session) : ces deux appels sont des
// actions ponctuelles déclenchées depuis l'écran, pas de l'état de session
// en continu.
import { http } from '../lib/http';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

export type UpdateMeBody = ApiRequestBody<'/auth/me', 'patch'>;
export type MeResponse = ApiResponse<'/auth/me', 'patch'>;
export type ChangePasswordBody = ApiRequestBody<
  '/auth/me/change-password',
  'post'
>;
export type ChangePasswordResult = ApiResponse<
  '/auth/me/change-password',
  'post'
>;

export async function updateMe(body: UpdateMeBody): Promise<MeResponse> {
  const { data } = await http.patch<MeResponse>('/auth/me', body);
  return data;
}

// Renvoie une PAIRE DE TOKENS FRAÎCHE (§A2 : toutes les autres sessions
// sont invalidées, celle-ci doit continuer sans interruption) — l'appelant
// DOIT la passer à authStore.setTokens() juste après, sinon la session en
// cours se retrouve avec un refresh token désormais révoqué.
export async function changePassword(
  body: ChangePasswordBody,
): Promise<ChangePasswordResult> {
  const { data } = await http.post<ChangePasswordResult>(
    '/auth/me/change-password',
    body,
  );
  return data;
}
