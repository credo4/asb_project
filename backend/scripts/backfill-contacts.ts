// Phase 3, §3a/A6 — backfill des demandes déjà en production, qui n'ont
// aucun rattachement (les colonnes contactId/organizationId de
// booking_requests sont nullables, aucune migration ne les remplit
// automatiquement — voir la migration add_clients_and_analytics).
//
// Usage (depuis backend/) :
//   npm run backfill:contacts -- --dry-run   # affiche ce qui serait fait, n'écrit rien
//   npm run backfill:contacts                # exécute réellement
//
// Ce que fait le script :
//   1. Regroupe les booking_requests SANS contactId par email normalisé
//      (minuscules, trim — même règle que ClientLinkingService).
//   2. Pour chaque email distinct : réutilise un Contact existant s'il y en
//      a déjà un (ne duplique jamais), sinon en crée un à partir des données
//      d'intake de la PREMIÈRE demande de ce groupe (fullName/phone/jobTitle).
//   3. Rattache TOUTES les demandes de ce groupe au contact (contactId).
//
// Volontairement HORS PÉRIMÈTRE ici (voir le prompt de spec, §A6) :
//   - Le rattachement à une organisation (organizationId) — seul le contact
//     est backfillé. Le rattachement organisation reste un geste manuel via
//     PATCH /admin/booking-requests/:id/link, au cas par cas (trop de
//     variantes d'écriture/homonymes pour être fiable en masse — voir §A3).
//   - roster_applications — hors périmètre de cette étape (voir CLAUDE.md).
//
// Chaque groupe d'email est traité dans SA PROPRE transaction : une erreur
// sur un groupe n'interrompt pas les autres (le script continue et rapporte
// les échecs à la fin plutôt que de tout annuler).
import { PrismaClient } from '@prisma/client';
import { normalizeEmail } from '../src/modules/clients/email-normalize.util';
import { splitFullName } from '../src/modules/clients/split-full-name.util';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const unlinked = await prisma.bookingRequest.findMany({
    where: { contactId: null },
    select: {
      id: true,
      workEmail: true,
      fullName: true,
      phone: true,
      jobTitle: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (unlinked.length === 0) {
    console.log(
      '[backfill:contacts] Aucune demande sans rattachement — rien à faire.',
    );
    await prisma.$disconnect();
    return;
  }

  // Regroupement par email normalisé — la PREMIÈRE demande de chaque groupe
  // (la plus ancienne, grâce à orderBy createdAt asc) fournit les données
  // d'intake utilisées pour créer le contact.
  const groups = new Map<string, typeof unlinked>();
  for (const row of unlinked) {
    const key = normalizeEmail(row.workEmail);
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  console.log(
    `[backfill:contacts] ${unlinked.length} demande(s) sans rattachement, ${groups.size} email(s) distinct(s).`,
  );

  let createdCount = 0;
  let reusedCount = 0;
  let linkedCount = 0;
  const errors: { email: string; error: string }[] = [];

  for (const [normalizedEmail, rows] of groups) {
    const first = rows[0];
    const { firstName, lastName } = splitFullName(first.fullName);

    try {
      const existingContact = await prisma.contact.findFirst({
        where: { normalizedEmail, deletedAt: null },
        select: { id: true },
      });

      if (dryRun) {
        if (existingContact) {
          console.log(
            `[dry-run] ${normalizedEmail} -> contact existant #${existingContact.id}, rattacherait ${rows.length} demande(s) (#${rows.map((r) => r.id).join(', #')}).`,
          );
          reusedCount += 1;
        } else {
          console.log(
            `[dry-run] ${normalizedEmail} -> créerait un contact "${firstName} ${lastName}", rattacherait ${rows.length} demande(s) (#${rows.map((r) => r.id).join(', #')}).`,
          );
          createdCount += 1;
        }
        linkedCount += rows.length;
        continue;
      }

      const contactId = await prisma.$transaction(async (tx) => {
        const contact =
          existingContact ??
          (await tx.contact.create({
            data: {
              firstName,
              lastName,
              email: first.workEmail,
              normalizedEmail,
              phone: first.phone,
              jobTitle: first.jobTitle,
            },
            select: { id: true },
          }));

        if (!existingContact) {
          await tx.activityLog.create({
            data: {
              actorId: null, // action système, cf. ActivityLog.actorId dans schema.prisma
              action: 'contact.created',
              entityType: 'Contact',
              entityId: contact.id,
              oldValue: undefined,
              newValue: {
                id: contact.id,
                email: first.workEmail,
                source: 'backfill:contacts',
              },
            },
          });
        }

        await tx.bookingRequest.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { contactId: contact.id },
        });

        for (const row of rows) {
          await tx.activityLog.create({
            data: {
              actorId: null,
              action: 'booking_request.linked',
              entityType: 'BookingRequest',
              entityId: row.id,
              oldValue: { contactId: null },
              newValue: { contactId: contact.id, source: 'backfill:contacts' },
            },
          });
        }

        return contact.id;
      });

      if (existingContact) {
        reusedCount += 1;
      } else {
        createdCount += 1;
      }
      linkedCount += rows.length;
      console.log(
        `[backfill:contacts] ${normalizedEmail} -> contact #${contactId}, ${rows.length} demande(s) rattachée(s).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ email: normalizedEmail, error: message });
      console.error(
        `[backfill:contacts] ÉCHEC pour ${normalizedEmail} : ${message}`,
      );
    }
  }

  console.log('---');
  console.log(
    dryRun
      ? `[dry-run] Terminé : ${createdCount} contact(s) seraient créés, ${reusedCount} réutilisé(s), ${linkedCount} demande(s) seraient rattachées. Rien n'a été écrit.`
      : `[backfill:contacts] Terminé : ${createdCount} contact(s) créés, ${reusedCount} réutilisés, ${linkedCount} demande(s) rattachées.`,
  );
  if (errors.length > 0) {
    console.log(`[backfill:contacts] ${errors.length} échec(s) :`);
    for (const e of errors) console.log(`  - ${e.email} : ${e.error}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
