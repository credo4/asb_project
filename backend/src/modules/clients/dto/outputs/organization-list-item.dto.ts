import { AdminRefDto, CountryRefDto } from './reference.dto';

export class OrganizationListItemDto {
  id!: number;
  name!: string;
  sector!: string | null;
  country!: CountryRefDto | null;
  website!: string | null;
  assignedAdmin!: AdminRefDto | null;
  // Gap comblé (module Clients, ligne 5.12 — approuvé avant modification) :
  // aucun de ces trois champs n'existait auparavant sur cet endpoint.
  bookingRequestsCount!: number;
  missionsCount!: number;
  // Calculée, jamais stockée : la plus récente des dates disponibles
  // (dernière demande, dernière mission, dernière mise à jour de la fiche
  // elle-même) — null uniquement si l'organisation n'a ni demande ni
  // mission ET n'a jamais été modifiée depuis sa création (cas théorique).
  lastActivityAt!: Date | null;
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
