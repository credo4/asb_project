import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Règles structurelles PARTAGÉES entre les DEUX chemins qui écrivent dans
// `speakers` : le CRUD admin (SpeakersService) et l'approbation d'une
// révision speaker (SpeakerRevisionsService.buildSpeakerUpdateData). Avant
// cette extraction, seul le premier chemin les appliquait — une révision
// approuvée pouvait donc laisser deux piliers `isPrimary` ou un thème
// rattaché à un pilier non associé, sans qu'aucun des deux services ne s'en
// aperçoive. Un seul jeu de règles, appelé des deux côtés : plus de place
// pour une divergence silencieuse.

export function assertPrimaryPillarCount(
  pillars?: { pillarId: number; isPrimary?: boolean }[],
): void {
  if (!pillars) {
    return;
  }
  const primaryCount = pillars.filter((p) => p.isPrimary).length;
  if (primaryCount > 1) {
    throw new BadRequestException(
      'Un seul pilier peut être marqué comme principal (isPrimary).',
    );
  }
}

export async function assertThemesMatchPillars(
  tx: Prisma.TransactionClient,
  themeIds: number[],
  pillarIds: number[],
): Promise<void> {
  if (themeIds.length === 0) {
    return;
  }

  const themes = await tx.theme.findMany({
    where: { id: { in: themeIds } },
    select: { id: true, name: true, pillarId: true },
  });

  const foundIds = new Set(themes.map((t) => t.id));
  const unknown = themeIds.filter((id) => !foundIds.has(id));
  if (unknown.length > 0) {
    throw new BadRequestException(
      `Thème(s) introuvable(s) : ${unknown.join(', ')}.`,
    );
  }

  const invalid = themes.filter((t) => !pillarIds.includes(t.pillarId));
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Thème(s) rattaché(s) à un pilier non associé à ce speaker : ${invalid
        .map((t) => t.name)
        .join(', ')}.`,
    );
  }
}
