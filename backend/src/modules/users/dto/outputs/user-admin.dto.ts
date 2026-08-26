import { Role, UserStatus } from '@prisma/client';

export class UserListItemDto {
  id!: number;
  email!: string;
  firstName!: string | null;
  lastName!: string | null;
  role!: Role;
  status!: UserStatus;
  lastLoginAt!: Date | null;
  createdAt!: Date;
}

export class UserListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class UserListResponseDto {
  data!: UserListItemDto[];
  meta!: UserListMetaDto;
}

export class UserDetailDto {
  id!: number;
  email!: string;
  firstName!: string | null;
  lastName!: string | null;
  role!: Role;
  status!: UserStatus;
  emailVerifiedAt!: Date | null;
  lastLoginAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}
