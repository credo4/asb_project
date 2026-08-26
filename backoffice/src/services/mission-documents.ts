import { http } from '../lib/http';
import type { ApiResponse } from '../types/api-helpers';
import type { MissionDetail } from './missions';

export type MissionDocument = MissionDetail['documents'][number];
export type MissionDocumentType = MissionDocument['type'];
export type DownloadLink = ApiResponse<
  '/admin/missions/{missionId}/documents/{documentId}/download-link',
  'get'
>;

export async function uploadMissionDocument(
  missionId: number,
  file: File,
  options: { type: MissionDocumentType; isSharedWithSpeaker: boolean },
): Promise<MissionDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', options.type);
  form.append('isSharedWithSpeaker', String(options.isSharedWithSpeaker));
  const { data } = await http.post<MissionDocument>(
    `/admin/missions/${missionId}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function deleteMissionDocument(
  missionId: number,
  documentId: number,
): Promise<void> {
  await http.delete(`/admin/missions/${missionId}/documents/${documentId}`);
}

export async function createMissionDocumentDownloadLink(
  missionId: number,
  documentId: number,
): Promise<DownloadLink> {
  const { data } = await http.get<DownloadLink>(
    `/admin/missions/${missionId}/documents/${documentId}/download-link`,
  );
  return data;
}

// Téléchargement en DEUX temps (prompt §3.6) : (1) demander le lien signé
// à courte durée de vie ci-dessus, (2) l'utiliser. Le second appel est fait
// ici en `fetch` brut (pas `http`/axios) -- ce lien est délibérément
// @Public() côté API (voir MissionDocumentDownloadController), un
// intercepteur qui poserait un header Authorization n'aurait pas de sens
// dessus. Erreurs traduites en message clair plutôt que laissées brutes :
// 410 = lien expiré (TTL court dépassé), 404 = document introuvable
// (supprimé après émission du lien -- jamais 410 dans ce cas précis, voir
// MissionDocumentsService#resolveDownload), 401 = lien invalide.
export class DownloadError extends Error {}

export async function downloadMissionDocument(
  missionId: number,
  documentId: number,
  filename: string,
): Promise<void> {
  const link = await createMissionDocumentDownloadLink(missionId, documentId);
  const response = await fetch(link.url);
  if (!response.ok) {
    if (response.status === 410) {
      throw new DownloadError('Ce lien de téléchargement a expiré. Réessayez.');
    }
    if (response.status === 404) {
      throw new DownloadError(
        'Ce document est introuvable — il a peut-être été supprimé.',
      );
    }
    throw new DownloadError('Impossible de télécharger ce document.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
