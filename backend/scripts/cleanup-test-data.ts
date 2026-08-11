// Consolidation avant la suite de la Phase 3, Partie F1 — nettoyage des
// données de test créées par tools/api-smoke-test/ (et plus généralement
// par tout test manuel identifiable par les mêmes marqueurs).
//
// Usage (depuis backend/) :
//   npm run cleanup:test-data                # dry-run PAR DÉFAUT — n'écrit rien
//   npm run cleanup:test-data -- --dry-run    # équivalent explicite
//   npm run cleanup:test-data -- --execute    # exécute RÉELLEMENT la suppression
//
// À L'INVERSE de scripts/backfill-contacts.ts (additif, dry-run sur
// demande), celui-ci est DESTRUCTEUR (suppression DURE) : le défaut le
// plus sûr est donc l'inverse — dry-run tant que `--execute` n'est pas
// fourni explicitement.
//
// Ce que fait le script :
//   1. Repère les booking_requests ET roster_applications dont
//      `organization` contient "[TEST]" OU dont `workEmail` correspond au
//      motif "smoke-*@example.com" (les deux marqueurs posés par
//      tools/api-smoke-test/index.html — voir son README).
//   2. Affiche la liste EXACTE des lignes concernées (id, référence,
//      organisation, email) avant toute écriture.
//   3. En mode --execute uniquement : supprime ces lignes en DUR
//      (`delete`, pas un soft delete) — les tables dépendantes (notes,
//      pièces jointes, évaluations, rappels) sont supprimées AUTOMATIQUEMENT
//      par les contraintes ON DELETE CASCADE déjà en place dans le schéma
//      (voir schema.prisma : booking_request_notes/attachments/reminders,
//      roster_application_evaluations/attachments), aucun code de
//      suppression manuel nécessaire pour elles.
//
// Volontairement HORS PÉRIMÈTRE :
//   - Le rattachement CRM (Contact/Organization) créé automatiquement par
//     email exact : jamais touché ici (une fiche CRM n'est pas une donnée
//     de test, même si la demande qui l'a créée en était une).
//   - Un compte User/Speaker né d'une conversion de candidature test (le
//     cas ne s'est pas produit avec tools/api-smoke-test à ce jour, mais
//     resterait possible) : supprimer la candidature ne cascade PAS vers
//     lui (convertedUserId/convertedSpeakerId sont ON DELETE SET NULL côté
//     roster_applications, jamais l'inverse) — le compte survit, orphelin
//     de sa candidature d'origine, ce qui est correct : ce n'est plus une
//     donnée de test une fois converti en vrai compte.
//
// NE JAMAIS lancer --execute directement contre la production sans montrer
// d'abord la sortie --dry-run et obtenir une confirmation explicite (même
// règle que pour toute migration destructrice, cf. CLAUDE.md §10).
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_ORG_MARKER = '[TEST]';
const TEST_EMAIL_PREFIX = 'smoke-';
const TEST_EMAIL_SUFFIX = '@example.com';

// booking_requests ET roster_applications ont toutes deux `organization`
// (String?) et `workEmail` (String) avec la même forme — un seul objet,
// typé pour chacun séparément côté appelant.
function testDataWhereClause() {
  return {
    OR: [
      { organization: { contains: TEST_ORG_MARKER } },
      {
        AND: [
          { workEmail: { startsWith: TEST_EMAIL_PREFIX } },
          { workEmail: { endsWith: TEST_EMAIL_SUFFIX } },
        ],
      },
    ],
  };
}

const bookingRequestTestDataWhere =
  testDataWhereClause() satisfies Prisma.BookingRequestWhereInput;
const rosterApplicationTestDataWhere =
  testDataWhereClause() satisfies Prisma.RosterApplicationWhereInput;

async function main() {
  const execute = process.argv.includes('--execute');
  const dryRun = !execute;

  const bookingRequests = await prisma.bookingRequest.findMany({
    where: bookingRequestTestDataWhere,
    select: { id: true, reference: true, organization: true, workEmail: true },
    orderBy: { id: 'asc' },
  });
  const rosterApplications = await prisma.rosterApplication.findMany({
    where: rosterApplicationTestDataWhere,
    select: {
      id: true,
      reference: true,
      organization: true,
      workEmail: true,
      status: true,
      convertedUserId: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log(
    `[cleanup:test-data] ${dryRun ? 'DRY-RUN (aucune écriture)' : 'EXÉCUTION RÉELLE'}`,
  );
  console.log(
    `[cleanup:test-data] ${bookingRequests.length} booking_request(s) et ${rosterApplications.length} roster_application(s) correspondent aux marqueurs de test.`,
  );

  if (bookingRequests.length === 0 && rosterApplications.length === 0) {
    console.log('[cleanup:test-data] Rien à faire.');
    await prisma.$disconnect();
    return;
  }

  console.log('\n--- booking_requests ---');
  for (const row of bookingRequests) {
    console.log(
      `  #${row.id} ${row.reference} — organization="${row.organization}" workEmail="${row.workEmail}"`,
    );
  }

  console.log('\n--- roster_applications ---');
  for (const row of rosterApplications) {
    const convertedNote = row.convertedUserId
      ? ` [CONVERTIE -> user #${row.convertedUserId} — le compte créé N'EST PAS supprimé, voir le commentaire en tête de script]`
      : '';
    console.log(
      `  #${row.id} ${row.reference} — organization="${row.organization}" workEmail="${row.workEmail}" status=${row.status}${convertedNote}`,
    );
  }

  if (dryRun) {
    console.log(
      "\n[dry-run] Rien n'a été écrit. Relance avec --execute pour supprimer réellement ces lignes (et leurs notes/pièces jointes/évaluations/rappels, via ON DELETE CASCADE).",
    );
    await prisma.$disconnect();
    return;
  }

  const bookingResult = await prisma.bookingRequest.deleteMany({
    where: { id: { in: bookingRequests.map((r) => r.id) } },
  });
  const rosterResult = await prisma.rosterApplication.deleteMany({
    where: { id: { in: rosterApplications.map((r) => r.id) } },
  });

  console.log(
    `\n[cleanup:test-data] Terminé : ${bookingResult.count} booking_request(s) et ${rosterResult.count} roster_application(s) supprimé(s) (suppression dure).`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
