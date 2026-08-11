import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SpeakerDetailRow } from '../speakers/speakers.includes';
import { PublicSpeakerDetailDto } from '../public/dto/public-speaker-detail.dto';
import { PublicSpeakerDetailRow } from '../public/public-speaker.select';
import { toPublicDetailDto } from '../public/mappers/public-speaker.mapper';
import { SpeakerRevisionPayloadDto } from './dto/speaker-revision-payload.dto';

type NamedRef = { id: number; name: string; slug: string };
type ThemeRef = { id: number; name: string; slug: string; pillarId: number };
type CountryRef = { id: number; name: string; iso2: string };

// Construit l'aperçu public d'une révision en réutilisant TEL QUEL le DTO et
// le mapper de la Phase 1c (public-speaker.mapper.ts) : le speaker voit
// exactement le composant qui servirait sa fiche une fois approuvée &
// publiée, pas une reconstruction séparée qui pourrait diverger avec le
// temps (cf. §4). On ne réutilise JAMAIS les relations complètes déjà
// chargées côté admin (SPEAKER_DETAIL_INCLUDE) pour construire les refs
// pillar/theme/format/language/country : comme pour PUBLIC_SPEAKER_DETAIL_SELECT,
// on ne résout QUE les champs {id, name, slug/iso2/code} via des requêtes
// dédiées, pour ne jamais laisser filtrer un champ éditorial superflu dans
// une DTO censée être une allow-list stricte.
@Injectable()
export class SpeakerRevisionPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPreview(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<PublicSpeakerDetailDto> {
    const merged = await this.mergeRow(speaker, payload);
    return toPublicDetailDto(merged);
  }

  private async mergeRow(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<PublicSpeakerDetailRow> {
    // `payload.field !== undefined`, PAS `'field' in payload` : sous ES2022+
    // avec useDefineForClassFields (actif ici, cf. tsconfig target ES2023),
    // chaque propriété optionnelle déclarée existe déjà (valeur undefined) dès
    // la construction de l'instance — `in` renverrait toujours true, même
    // pour un champ jamais envoyé. Même convention que SpeakersService
    // (`dto.pillars ? ... : undefined`).
    const countryId =
      payload.countryId !== undefined ? payload.countryId : speaker.countryId;
    const country = countryId ? await this.resolveCountry(countryId) : null;

    const [pillars, themes, formats, languages] = await Promise.all([
      this.mergePillars(speaker, payload),
      this.mergeThemes(speaker, payload),
      this.mergeFormats(speaker, payload),
      this.mergeLanguages(speaker, payload),
    ]);

    return {
      // Usage strictement interne (voir le commentaire sur
      // PUBLIC_SPEAKER_DETAIL_SELECT.id) : jamais copié dans le DTO de sortie
      // par toPublicDetailDto, seulement présent ici parce que
      // PublicSpeakerDetailRow l'exige structurellement depuis que
      // AnalyticsService en a besoin (Phase 3, §3a).
      id: speaker.id,
      slug: speaker.slug,
      publicName:
        payload.publicName !== undefined
          ? payload.publicName
          : speaker.publicName,
      firstName:
        payload.firstName !== undefined ? payload.firstName : speaker.firstName,
      lastName:
        payload.lastName !== undefined ? payload.lastName : speaker.lastName,
      professionalTitle:
        payload.professionalTitle !== undefined
          ? payload.professionalTitle
          : speaker.professionalTitle,
      currentOrganization:
        payload.currentOrganization !== undefined
          ? payload.currentOrganization
          : speaker.currentOrganization,
      currentPosition:
        payload.currentPosition !== undefined
          ? payload.currentPosition
          : speaker.currentPosition,
      profilePhotoUrl:
        payload.profilePhotoUrl !== undefined
          ? payload.profilePhotoUrl
          : speaker.profilePhotoUrl,
      coverPhotoUrl:
        payload.coverPhotoUrl !== undefined
          ? payload.coverPhotoUrl
          : speaker.coverPhotoUrl,
      shortBio:
        payload.shortBio !== undefined ? payload.shortBio : speaker.shortBio,
      fullBio:
        payload.fullBio !== undefined ? payload.fullBio : speaker.fullBio,
      quote: payload.quote !== undefined ? payload.quote : speaker.quote,
      expertiseSummary:
        payload.expertiseSummary !== undefined
          ? payload.expertiseSummary
          : speaker.expertiseSummary,
      valueProposition:
        payload.valueProposition !== undefined
          ? payload.valueProposition
          : speaker.valueProposition,
      careerPath:
        payload.careerPath !== undefined
          ? payload.careerPath
          : speaker.careerPath,
      keyAchievements:
        payload.keyAchievements !== undefined
          ? payload.keyAchievements
          : speaker.keyAchievements,
      awards: payload.awards !== undefined ? payload.awards : speaker.awards,
      websiteUrl:
        payload.websiteUrl !== undefined
          ? payload.websiteUrl
          : speaker.websiteUrl,
      linkedinUrl:
        payload.linkedinUrl !== undefined
          ? payload.linkedinUrl
          : speaker.linkedinUrl,
      socialLinks:
        payload.socialLinks !== undefined
          ? (payload.socialLinks as unknown as Record<string, string>)
          : speaker.socialLinks,
      feeTierPublic: speaker.feeTierPublic, // jamais éditable par le speaker (cf. §3)
      showBudget: speaker.showBudget,
      showLocation: speaker.showLocation,
      city: payload.city !== undefined ? payload.city : speaker.city,
      country,
      pillars,
      themes,
      formats,
      languages,
      engagements: this.mergeEngagements(speaker, payload),
      // Le média n'est plus un champ du payload de révision (consolidation
      // Phase 2, Partie A) : l'aperçu réutilise donc directement le sous-
      // ensemble APPROVED du profil live, exactement ce que verrait le
      // public une fois la révision approuvée — pas de fusion à faire.
      media: this.approvedMedia(speaker),
    };
  }

  private async resolveCountry(id: number): Promise<CountryRef | null> {
    return this.prisma.country.findUnique({
      where: { id },
      select: { id: true, name: true, iso2: true },
    });
  }

  private async mergePillars(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<PublicSpeakerDetailRow['pillars']> {
    const entries = payload.pillars
      ? payload.pillars.map((p) => ({
          pillarId: p.pillarId,
          isPrimary: p.isPrimary ?? false,
          displayOrder: p.displayOrder ?? 0,
        }))
      : speaker.pillars.map((p) => ({
          pillarId: p.pillarId,
          isPrimary: p.isPrimary,
          displayOrder: p.displayOrder,
        }));

    const ids = entries.map((e) => e.pillarId);
    const refs = ids.length
      ? await this.prisma.pillar.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const byId = new Map(refs.map((r) => [r.id, r]));

    return entries
      .filter((e) => byId.has(e.pillarId))
      .map((e) => ({
        pillar: byId.get(e.pillarId) as NamedRef,
        isPrimary: e.isPrimary,
        displayOrder: e.displayOrder,
      }));
  }

  private async mergeThemes(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<PublicSpeakerDetailRow['themes']> {
    const ids = payload.themeIds ?? speaker.themes.map((t) => t.themeId);
    const refs = ids.length
      ? await this.prisma.theme.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, slug: true, pillarId: true },
        })
      : [];
    const byId = new Map(refs.map((r) => [r.id, r]));

    return ids
      .filter((id) => byId.has(id))
      .map((id) => ({ theme: byId.get(id) as ThemeRef }));
  }

  private async mergeFormats(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<PublicSpeakerDetailRow['formats']> {
    const ids = payload.formatIds ?? speaker.formats.map((f) => f.formatId);
    const refs = ids.length
      ? await this.prisma.format.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const byId = new Map(refs.map((r) => [r.id, r]));

    return ids
      .filter((id) => byId.has(id))
      .map((id) => ({ format: byId.get(id) as NamedRef }));
  }

  private async mergeLanguages(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): Promise<PublicSpeakerDetailRow['languages']> {
    const entries = payload.languages
      ? payload.languages.map((l) => ({
          languageId: l.languageId,
          proficiency: l.proficiency ?? ('FLUENT' as const),
          canPresent: l.canPresent ?? true,
          canQa: l.canQa ?? true,
          canModerate: l.canModerate ?? false,
        }))
      : speaker.languages.map((l) => ({
          languageId: l.languageId,
          proficiency: l.proficiency,
          canPresent: l.canPresent,
          canQa: l.canQa,
          canModerate: l.canModerate,
        }));

    const ids = entries.map((e) => e.languageId);
    const refs = ids.length
      ? await this.prisma.language.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, code: true },
        })
      : [];
    const byId = new Map(refs.map((r) => [r.id, r]));

    return entries
      .filter((e) => byId.has(e.languageId))
      .map((e) => ({
        language: byId.get(e.languageId) as {
          id: number;
          name: string;
          code: string;
        },
        proficiency: e.proficiency,
        canPresent: e.canPresent,
        canQa: e.canQa,
        canModerate: e.canModerate,
      }));
  }

  private mergeEngagements(
    speaker: SpeakerDetailRow,
    payload: SpeakerRevisionPayloadDto,
  ): PublicSpeakerDetailRow['engagements'] {
    if (!payload.engagements) {
      return speaker.engagements;
    }
    // Aperçu best-effort : un engagement proposé n'a pas encore d'id ni de
    // pays résolu (juste un countryId brut) — country omis dans l'aperçu
    // plutôt que de déclencher une requête par engagement pour un détail mineur.
    return payload.engagements.map((e, index) => ({
      id: -1 * (index + 1), // id négatif = "pas encore un vrai engagement" (aperçu uniquement)
      eventName: e.eventName,
      organization: e.organization ?? null,
      country: null,
      eventDate: e.eventDate ? new Date(e.eventDate) : null,
      dateLabel: e.dateLabel ?? null,
      role: e.role ?? null,
      topic: e.topic ?? null,
      description: e.description ?? null,
      photoUrl: e.photoUrl ?? null,
      videoUrl: e.videoUrl ?? null,
      externalUrl: e.externalUrl ?? null,
      displayOrder: e.displayOrder ?? 0,
    }));
  }

  private approvedMedia(
    speaker: SpeakerDetailRow,
  ): PublicSpeakerDetailRow['media'] {
    return speaker.media
      .filter((m) => m.status === 'APPROVED')
      .map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        url: m.url,
        displayOrder: m.displayOrder,
      }));
  }
}
