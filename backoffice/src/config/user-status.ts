// Paramètres > Utilisateurs — statuts de compte (`UserStatus`) et rôles
// (`Role`, restreint à ADMIN/SUPER_ADMIN ici : les comptes SPEAKER
// n'apparaissent jamais dans ce module, voir CLAUDE.md).
import type { BadgeFamily } from './speaker-status';

export interface UserStatusInfo {
  label: string;
  family: BadgeFamily;
}

export const USER_STATUS: Record<string, UserStatusInfo> = {
  ACTIVE: { label: 'Actif', family: 'success' },
  INVITED: { label: 'Invité, en attente', family: 'info' },
  SUSPENDED: { label: 'Suspendu', family: 'warn' },
  DISABLED: { label: 'Désactivé', family: 'danger' },
};

export function userStatusInfo(status: string): UserStatusInfo {
  return USER_STATUS[status] ?? { label: status, family: 'neutral' };
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  SPEAKER: 'Speaker',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
