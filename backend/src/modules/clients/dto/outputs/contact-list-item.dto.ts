import { CountryRefDto, OrganizationRefDto } from './reference.dto';

export class ContactListItemDto {
  id!: number;
  firstName!: string;
  lastName!: string;
  email!: string;
  phone!: string | null;
  jobTitle!: string | null;
  organization!: OrganizationRefDto | null;
  country!: CountryRefDto | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ContactListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class ContactListResponseDto {
  data!: ContactListItemDto[];
  meta!: ContactListMetaDto;
}
