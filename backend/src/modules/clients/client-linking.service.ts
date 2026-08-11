import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  sanitizeOptionalText,
  sanitizeText,
} from '../../common/utils/sanitize-text.util';
import { normalizeEmail } from './email-normalize.util';
import { splitFullName } from './split-full-name.util';

// Logique de résolution/création de fiches CRM, PARTAGÉE entre :
// - BookingRequestsService#createFromPublic (rattachement AUTOMATIQUE par
//   email exact, §A3 — jamais de création automatique) ;
// - BookingRequestsService#link, derrière PATCH /admin/booking-requests/:id/link
//   (rattachement MANUEL, avec ou sans création à partir des données
//   d'intake — "convertir en fiche client", §A5).
//
// Ne connaît PAS le DTO de sortie BookingRequestDetailDto : cette
// orchestration (relecture + mapping) reste dans BookingRequestsService, qui
// possède déjà le modèle BookingRequest. Ce service ne manipule que
// Contact/Organization.
@Injectable()
export class ClientLinkingService {
  constructor(private readonly activityLog: ActivityLogService) {}

  // §A3 — rattachement automatique, SANS création. Appelé DANS la
  // transaction de création de la demande : un email inconnu ne doit RIEN
  // créer (une fiche fantôme à chaque formulaire de spam serait pire que
  // l'absence de rattachement).
  async resolveAutoLink(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<{ contactId?: number; organizationId?: number }> {
    const normalized = normalizeEmail(email);
    const contact = await tx.contact.findFirst({
      where: { normalizedEmail: normalized, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!contact) {
      return {};
    }
    return {
      contactId: contact.id,
      organizationId: contact.organizationId ?? undefined,
    };
  }

  async assertOrganizationExists(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<number> {
    const org = await tx.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException(`Organisation ${id} introuvable.`);
    }
    return org.id;
  }

  async assertContactExists(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<number> {
    const contact = await tx.contact.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!contact) {
      throw new NotFoundException(`Contact ${id} introuvable.`);
    }
    return contact.id;
  }

  // « Convertir en fiche client » côté organisation : crée une nouvelle
  // Organization à partir du champ texte libre `booking_requests.organization`
  // — SANS jamais modifier ce champ d'origine (voir CLAUDE.md, donnée
  // d'intake immuable).
  async createOrganizationFromIntake(
    tx: Prisma.TransactionClient,
    organizationName: string | null,
    actor: AuthenticatedUser,
  ): Promise<number> {
    if (!organizationName || !organizationName.trim()) {
      throw new BadRequestException(
        'Impossible de créer une organisation : le champ "organization" de la demande est vide.',
      );
    }

    const row = await tx.organization.create({
      data: { name: sanitizeText(organizationName) },
    });

    await this.activityLog.record(tx, {
      actorId: actor.id,
      action: 'organization.created',
      entityType: 'Organization',
      entityId: row.id,
      oldValue: null,
      newValue: { id: row.id, name: row.name },
    });

    return row.id;
  }

  // « Convertir en fiche client » côté contact : crée un Contact à partir des
  // champs d'intake — SANS jamais les modifier. Si un contact existe déjà
  // pour cet email normalisé (cas rare : rattachement auto raté puis
  // création manuelle demandée quand même), on le RÉUTILISE plutôt que de
  // heurter la contrainte d'unicité (A4) — même philosophie que le
  // rattachement automatique : un email connu ne produit jamais deux fiches.
  async createContactFromIntake(
    tx: Prisma.TransactionClient,
    intake: {
      fullName: string;
      workEmail: string;
      phone: string | null;
      jobTitle: string | null;
    },
    organizationId: number | undefined,
    actor: AuthenticatedUser,
  ): Promise<number> {
    const normalized = normalizeEmail(intake.workEmail);

    const existing = await tx.contact.findFirst({
      where: { normalizedEmail: normalized, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const { firstName, lastName } = splitFullName(intake.fullName);

    const row = await tx.contact.create({
      data: {
        firstName: sanitizeText(firstName),
        lastName: sanitizeText(lastName),
        email: intake.workEmail,
        normalizedEmail: normalized,
        phone: sanitizeOptionalText(intake.phone),
        jobTitle: sanitizeOptionalText(intake.jobTitle),
        organizationId,
      },
    });

    await this.activityLog.record(tx, {
      actorId: actor.id,
      action: 'contact.created',
      entityType: 'Contact',
      entityId: row.id,
      oldValue: null,
      newValue: { id: row.id, email: row.email },
    });

    return row.id;
  }
}
