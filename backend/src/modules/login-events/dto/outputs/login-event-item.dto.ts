// Pas d'IP en clair (voir §5/§26, CLAUDE.md) : `ipHash` est le seul champ
// exposé, un HMAC-SHA256 non réversible — voir LoginEventsService.
export class LoginEventUserRefDto {
  id!: number;
  email!: string;
  firstName!: string | null;
  lastName!: string | null;
}

export class LoginEventItemDto {
  id!: number;
  emailAttempted!: string;
  success!: boolean;
  failureReason!: string | null;
  ipHash!: string | null;
  userAgent!: string | null;
  user!: LoginEventUserRefDto | null;
  createdAt!: Date;
}

export class LoginEventListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class LoginEventListResponseDto {
  data!: LoginEventItemDto[];
  meta!: LoginEventListMetaDto;
}
