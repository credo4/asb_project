import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpeakerStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SpeakerAvailabilityService } from '../speaker-availability/speaker-availability.service';
import { parseDateOnly } from '../speaker-availability/availability-date.util';
import { QueryMatchingCandidatesDto } from './dto/query-matching-candidates.dto';
import {
  MatchingCandidateDto,
  MatchingCandidatesResponseDto,
  MatchingCriteriaUsedDto,
} from './dto/outputs/matching-candidate.dto';

// Statuts qu'"includeUnpublished" ne fait JAMAIS remonter : ARCHIVED et
// APPLICATION_REJECTED ne sont pas "en cours de validation" (le cas visé
// par l'option, §1) mais des fins de vie délibérées — les inclure serait un
// bug, pas une fonctionnalité.
const EXCLUDED_EVEN_WHEN_UNPUBLISHED: SpeakerStatus[] = [
  SpeakerStatus.ARCHIVED,
  SpeakerStatus.APPLICATION_REJECTED,
];

interface ResolvedCriteria {
  pillar: string | null;
  theme: string | null;
  format: string | null;
  language: string | null;
  country: string | null;
  eventDate: Date;
  eventEndDate: Date;
  isVirtual: boolean;
  includeUnpublished: boolean;
}

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: SpeakerAvailabilityService,
  ) {}

  // §1 — recherche ASSISTÉE : aucun scoring, aucun classement automatique
  // (cahier des charges §31 range le matching automatique en v2). Retourne,
  // pour chaque speaker candidat, des critères EXPLICITEMENT satisfaits ou
  // non — jamais un pourcentage.
  async findCandidates(
    bookingRequestId: number,
    query: QueryMatchingCandidatesDto,
  ): Promise<MatchingCandidatesResponseDto> {
    const bookingRequest = await this.prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
    });
    if (!bookingRequest) {
      throw new NotFoundException(`Demande ${bookingRequestId} introuvable.`);
    }

    const criteria = this.resolveCriteria(bookingRequest, query);

    const statusWhere = criteria.includeUnpublished
      ? { notIn: EXCLUDED_EVEN_WHEN_UNPUBLISHED }
      : SpeakerStatus.PUBLISHED;

    const speakers = await this.prisma.speaker.findMany({
      where: { status: statusWhere, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        publicName: true,
        slug: true,
        profilePhotoUrl: true,
        professionalTitle: true,
        status: true,
        feeTierPublic: true,
        pillars: { select: { pillar: { select: { slug: true, name: true } } } },
        themes: { select: { theme: { select: { slug: true, name: true } } } },
        formats: { select: { format: { select: { slug: true, name: true } } } },
        languages: {
          select: { language: { select: { code: true, name: true } } },
        },
        availabilityPeriods: {
          where: { deletedAt: null },
          select: { type: true, startDate: true, endDate: true },
        },
        travelPreference: {
          select: {
            travelScope: true,
            availableForVirtual: true,
            minimumNoticeDays: true,
            countries: { select: { country: { select: { iso2: true } } } },
          },
        },
      },
    });

    const candidates: MatchingCandidateDto[] = [];
    for (const speaker of speakers) {
      const availability = await this.availabilityService.checkAvailability(
        speaker.id,
        {
          startDate: criteria.eventDate,
          endDate: criteria.eventEndDate,
          country: criteria.country,
          isVirtual: criteria.isVirtual,
        },
      );

      const satisfied: string[] = [];
      const unsatisfied: string[] = [];

      if (criteria.pillar) {
        const match = speaker.pillars.find(
          (p) => p.pillar.slug === criteria.pillar,
        );
        if (match) {
          satisfied.push(`Pilier : ${match.pillar.name}`);
        } else {
          unsatisfied.push(`Pilier : ne couvre pas "${criteria.pillar}"`);
        }
      }
      if (criteria.theme) {
        const match = speaker.themes.find(
          (t) => t.theme.slug === criteria.theme,
        );
        if (match) {
          satisfied.push(`Thème : ${match.theme.name}`);
        } else {
          unsatisfied.push(`Thème : ne couvre pas "${criteria.theme}"`);
        }
      }
      if (criteria.format) {
        const match = speaker.formats.find(
          (f) => f.format.slug === criteria.format,
        );
        if (match) {
          satisfied.push(`Format : ${match.format.name}`);
        } else {
          unsatisfied.push(`Format : ne propose pas "${criteria.format}"`);
        }
      }
      if (criteria.language) {
        const match = speaker.languages.find(
          (l) => l.language.code === criteria.language,
        );
        if (match) {
          satisfied.push(`Langue : ${match.language.name}`);
        } else {
          unsatisfied.push(`Langue : ne parle pas "${criteria.language}"`);
        }
      }

      // Pays/région, dates, présentiel/virtuel : entièrement délégués à
      // checkAvailability() (§1 — ne réimplémente aucune logique de dates
      // ou de déplacement), traduits en critère satisfait/non satisfait à
      // partir de son verdict + ses raisons explicites.
      if (availability.status === 'UNAVAILABLE') {
        unsatisfied.push(`Disponibilité : ${availability.reasons.join('; ')}`);
      } else if (availability.status === 'AVAILABLE') {
        satisfied.push(
          availability.reasons.length > 0
            ? `Disponibilité : ${availability.reasons.join('; ')}`
            : 'Disponibilité : compatible',
        );
      }
      // UNKNOWN (§1 — rien de déclaré) : ni satisfait ni non satisfait,
      // signalé uniquement via `availability.status` dans la réponse — on
      // n'exclut PAS un speaker qui n'a rien rempli.

      candidates.push({
        speaker: {
          id: speaker.id,
          displayName:
            speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`,
          slug: speaker.slug,
          profilePhotoUrl: speaker.profilePhotoUrl,
          professionalTitle: speaker.professionalTitle,
          status: speaker.status,
          feeTierPublic: speaker.feeTierPublic,
        },
        availability: {
          status: availability.status,
          reasons: availability.reasons,
        },
        criteria: { satisfied, unsatisfied },
      });
    }

    return {
      criteriaUsed: this.toCriteriaUsedDto(criteria),
      requestContext: {
        eventLocation: bookingRequest.eventLocation,
        eventFormat: bookingRequest.eventFormat,
        language: bookingRequest.language,
        audienceSize: bookingRequest.audienceSize,
        estimatedBudget: bookingRequest.estimatedBudget,
      },
      candidates,
    };
  }

  // Voir le commentaire en tête de query-matching-candidates.dto.ts : seul
  // eventDate est réellement pré-remplissable depuis la demande (colonne
  // structurée) ; le reste vient exclusivement des query params, sans
  // tentative de deviner quoi que ce soit depuis les champs texte libre.
  private resolveCriteria(
    bookingRequest: { eventDate: Date | null },
    query: QueryMatchingCandidatesDto,
  ): ResolvedCriteria {
    const eventDate = query.eventDate
      ? parseDateOnly(query.eventDate)
      : bookingRequest.eventDate;
    if (!eventDate) {
      throw new BadRequestException(
        "Impossible de déterminer une date d'événement : la demande n'en a pas, et aucun paramètre eventDate n'a été fourni.",
      );
    }
    const eventEndDate = query.eventEndDate
      ? parseDateOnly(query.eventEndDate)
      : eventDate;

    return {
      pillar: query.pillar ?? null,
      theme: query.theme ?? null,
      format: query.format ?? null,
      language: query.language ?? null,
      country: query.country ?? null,
      eventDate,
      eventEndDate,
      isVirtual: query.isVirtual ?? false,
      includeUnpublished: query.includeUnpublished ?? false,
    };
  }

  private toCriteriaUsedDto(
    criteria: ResolvedCriteria,
  ): MatchingCriteriaUsedDto {
    return {
      pillar: criteria.pillar,
      theme: criteria.theme,
      format: criteria.format,
      language: criteria.language,
      country: criteria.country,
      eventDate: criteria.eventDate.toISOString().slice(0, 10),
      eventEndDate: criteria.eventEndDate.toISOString().slice(0, 10),
      isVirtual: criteria.isVirtual,
      includeUnpublished: criteria.includeUnpublished,
    };
  }
}
