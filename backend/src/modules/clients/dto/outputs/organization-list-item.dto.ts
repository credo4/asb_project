import { AdminRefDto, CountryRefDto } from './reference.dto';

export class OrganizationListItemDto {
  id!: number;
  name!: string;
  sector!: string | null;
  country!: CountryRefDto | null;
  website!: string | null;
  assignedAdmin!: AdminRefDto | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class OrganizationListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class OrganizationListResponseDto {
  data!: OrganizationListItemDto[];
  meta!: OrganizationListMetaDto;
}
