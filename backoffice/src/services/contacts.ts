// Module Clients (ligne 5.12) : consultation de fiche contact + recherche
// pour le rattachement d'une demande (voir booking-requests.ts#linkBookingRequest).
// Pas de CRUD contact en libre-service : un contact se crée UNIQUEMENT via
// `createContactFromIntake` au moment du rattachement.
import { http } from '../lib/http';
import type { ApiResponse } from '../types/api-helpers';

export type ContactListItem = ApiResponse<'/admin/contacts', 'get'>['data'][number];
export type ContactDetail = ApiResponse<'/admin/contacts/{id}', 'get'>;

export async function fetchContact(id: number): Promise<ContactDetail> {
  const { data } = await http.get<ContactDetail>(`/admin/contacts/${id}`);
  return data;
}

/** Recherche par nom/email -- alimente l'AutoComplete de rattachement. */
export async function searchContacts(search: string): Promise<ContactListItem[]> {
  if (search.trim().length < 2) return [];
  const { data } = await http.get<ApiResponse<'/admin/contacts', 'get'>>(
    '/admin/contacts',
    { params: { page: 1, perPage: 10, search } },
  );
  return data.data;
}
