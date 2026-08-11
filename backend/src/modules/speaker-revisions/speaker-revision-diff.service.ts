import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SpeakerDetailRow } from '../speakers/speakers.includes';
import { SpeakerRevisionPayloadDto } from './dto/speaker-revision-payload.dto';
import {
  FieldDiffDto,
  RelationDiffDto,
  SpeakerRevisionDiffDto,
} from './dto/outputs/speaker-revision-diff.dto';
import {
  REVISION_FIELD_LABELS,
  REVISION_RELATION_LABELS,
  REVISION_SCALAR_FIELDS,
} from './speaker-revision.constants';

function isEqualValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true; // null et undefined comptent comme "vide"
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffByIds(
  currentIds: number[],
  proposedIds: number[],
  nameById: Map<number, string>,
): { added: string[]; removed: string[] } {
  const currentSet = new Set(currentIds);
  const proposedSet = new Set(proposedIds);
  return {
    added: proposedIds
      .filter((id) => !currentSet.has(id))
      .map((id) => nameById.get(id) ?? `#${id}`),
    removed: currentIds
      .filter((id) => !proposedSet.has(id))
      .map((id) => nameById.get(id) ?? `#${id}`),
  };
}

function diffByStrings(
  current: string[],
  proposed: string[],
): { added: string[]; removed: string[] } {
  const currentSet = new Set(current);
  const proposedSet = new Set(proposed);
  return {
    added: proposed.filter((v) => !currentSet.has(v)),
    removed: current.filter((v) => !proposedSet.has(v)),
  };
}

// Service dédié à la comparaison avant/après (cf. §6) : ne renvoie QUE les
// champs/relations réellement différents entre la fiche live et le payload
// proposé — jamais stocké, toujours recalculé à la volée pour rester
// cohérent avec l'état live actuel (qui peut avoir changé depuis la
// soumission de la révision, ex. modification admin directe).
@Injectable()
export class SpeakerRevisionDiffService {
  constructor(private readonly prisma: PrismaService) {}

  async buildDiff(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<SpeakerRevisionDiffDto> {
    return {
      scalarChanges: await this.buildScalarChanges(speaker, payload),
      relationChanges: await this.buildRelationChanges(speaker, payload),
    };
  }

  private async buildScalarChanges(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<FieldDiffDto[]> {
    const changes: FieldDiffDto[] = [];

    for (const field of REVISION_SCALAR_FIELDS) {
      if (field === 'countryId') {
        continue; // traité à part (résolution du nom)
      }
      // `payload[field] !== undefined`, PAS `field in payload` : les champs
      // optionnels de la classe sont définis (valeur undefined) dès la
      // construction sous ES2022+/useDefineForClassFields — `in` renverrait
      // toujours true, même pour un champ jamais envoyé par le client (même
      // convention que dto.pillars ? ... : undefined dans SpeakersService).
      const after = payload[
        field as keyof SpeakerRevisionPayloadDto
      ] as unknown;
      if (after === undefined) {
        continue; // absent du payload = inchangé
      }
      const before = speaker[field as keyof SpeakerDetailRow] as unknown;
      if (!isEqualValue(before, after)) {
        changes.push({
          field,
          label: REVISION_FIELD_LABELS[field],
          before,
          after,
        });
      }
    }

    if (
      payload.countryId !== undefined &&
      payload.countryId !== speaker.countryId
    ) {
      const ids = [speaker.countryId, payload.countryId].filter(
        (id): id is number => id != null,
      );
      const countries = ids.length
        ? await this.prisma.country.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : [];
      const nameById = new Map(countries.map((c) => [c.id, c.name]));
      changes.push({
        field: 'countryId',
        label: REVISION_FIELD_LABELS.countryId,
        before:
          speaker.countryId != null
            ? (nameById.get(speaker.countryId) ?? speaker.countryId)
            : null,
        after:
          payload.countryId != null
            ? (nameById.get(payload.countryId) ?? payload.countryId)
            : null,
      });
    }

    return changes;
  }

  private async buildRelationChanges(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<RelationDiffDto[]> {
    const changes: RelationDiffDto[] = [];

    if (payload.pillars) {
      const currentIds = speaker.pillars.map((p) => p.pillarId);
      const proposedIds = payload.pillars.map((p) => p.pillarId);
      const nameById = await this.resolveNames('pillar', [
        ...currentIds,
        ...proposedIds,
      ]);
      this.pushRelationDiff(
        changes,
        'pillars',
        diffByIds(currentIds, proposedIds, nameById),
      );
    }

    if (payload.themeIds) {
      const currentIds = speaker.themes.map((t) => t.themeId);
      const nameById = await this.resolveNames('theme', [
        ...currentIds,
        ...payload.themeIds,
      ]);
      this.pushRelationDiff(
        changes,
        'themeIds',
        diffByIds(currentIds, payload.themeIds, nameById),
      );
    }

    if (payload.keywords) {
      const currentKeywords = speaker.keywords.map((k) => k.keyword);
      this.pushRelationDiff(
        changes,
        'keywords',
        diffByStrings(currentKeywords, payload.keywords),
      );
    }

    if (payload.formatIds) {
      const currentIds = speaker.formats.map((f) => f.formatId);
      const nameById = await this.resolveNames('format', [
        ...currentIds,
        ...payload.formatIds,
      ]);
      this.pushRelationDiff(
        changes,
        'formatIds',
        diffByIds(currentIds, payload.formatIds, nameById),
      );
    }

    if (payload.languages) {
      const currentIds = speaker.languages.map((l) => l.languageId);
      const proposedIds = payload.languages.map((l) => l.languageId);
      const nameById = await this.resolveNames('language', [
        ...currentIds,
        ...proposedIds,
      ]);
      this.pushRelationDiff(
        changes,
        'languages',
        diffByIds(currentIds, proposedIds, nameById),
      );
    }

    if (payload.engagements) {
      const currentNames = speaker.engagements.map((e) => e.eventName);
      const proposedNames = payload.engagements.map((e) => e.eventName);
      this.pushRelationDiff(
        changes,
        'engagements',
        diffByStrings(currentNames, proposedNames),
      );
    }

    // Le média n'est plus un champ du payload de révision (consolidation
    // Phase 2, Partie A) : rien à diffuser ici, il a son propre cycle
    // upload → revue indépendant du brouillon de profil.

    return changes;
  }

  private pushRelationDiff(
    changes: RelationDiffDto[],
    field: keyof typeof REVISION_RELATION_LABELS,
    diff: { added: string[]; removed: string[] },
  ): void {
    if (diff.added.length > 0 || diff.removed.length > 0) {
      changes.push({
        field,
        label: REVISION_RELATION_LABELS[field],
        added: diff.added,
        removed: diff.removed,
      });
    }
  }

  private async resolveNames(
    model: 'pillar' | 'theme' | 'format' | 'language',
    ids: number[],
  ): Promise<Map<number, string>> {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      return new Map();
    }

    let rows: { id: number; name: string }[];
    switch (model) {
      case 'pillar':
        rows = await this.prisma.pillar.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true, name: true },
        });
        break;
      case 'theme':
        rows = await this.prisma.theme.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true, name: true },
        });
        break;
      case 'format':
        rows = await this.prisma.format.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true, name: true },
        });
        break;
      case 'language':
        rows = await this.prisma.language.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true, name: true },
        });
        break;
    }

    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
