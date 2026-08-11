import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Version légère de SpeakerRevisionsService#getOwnSpeakerOrThrow (qui a
// besoin de la fiche complète pour les invariants métier) : speaker-media et
// speaker-documents n'ont besoin que du speakerId pour scoper leurs requêtes
// (voir §2 — jamais un findUnique({ id }) suivi d'un contrôle de propriété,
// toujours where: { id, speakerId }). Même principe non-contournable : dérivé
// UNIQUEMENT de userId (l'utilisateur authentifié du JWT), aucune route
// n'accepte le moindre identifiant fourni par l'appelant pour désigner "quel
// speaker".
export async function resolveOwnSpeakerId(
  prisma: PrismaService,
  userId: number,
): Promise<number> {
  const speaker = await prisma.speaker.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!speaker) {
    throw new NotFoundException('Aucun profil speaker lié à ce compte.');
  }
  return speaker.id;
}
