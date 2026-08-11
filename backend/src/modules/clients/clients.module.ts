import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { ContactsController } from './contacts.controller';
import { OrganizationsService } from './organizations.service';
import { ContactsService } from './contacts.service';
import { ClientLinkingService } from './client-linking.service';

// ClientLinkingService est exporté : BookingRequestsModule l'importe pour le
// rattachement automatique à la création (§A3) et pour
// PATCH /admin/booking-requests/:id/link (§A5) — voir booking-requests.module.ts.
@Module({
  controllers: [OrganizationsController, ContactsController],
  providers: [OrganizationsService, ContactsService, ClientLinkingService],
  exports: [OrganizationsService, ContactsService, ClientLinkingService],
})
export class ClientsModule {}
