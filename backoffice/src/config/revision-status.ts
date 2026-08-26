import type { StatusInfo } from './booking-status';

// Les 6 statuts de `RevisionStatus` (voir backend/prisma/schema.prisma).
export const REVISION_STATUS: Record<string, StatusInfo> = {
  DRAFT: { label: 'Brouillon', family: 'neutral' },
  SUBMITTED: { label: 'Soumise', family: 'warn' },
  APPROVED: { label: 'Approuvée', family: 'success' },
  CHANGES_REQUESTED: { label: 'Corrections demandées', family: 'danger' },
  REJECTED: { label: 'Refusée', family: 'danger' },
  WITHDRAWN: { label: 'Retirée', family: 'neutral' },
};

export function revisionStatusInfo(status: string): StatusInfo {
  return REVISION_STATUS[status] ?? { label: status, family: 'neutral' };
}
