import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PublicSortOrder,
  PublicSpeakerSortBy,
  QueryPublicSpeakersDto,
} from '../dto/query-public-speakers.dto';
import {
  PublicSpeakerListItemDto,
  PublicSpeakerListResponseDto,
} from '../dto/public-speaker-list-item.dto';
import { PublicSpeakerDetailDto } from '../dto/public-speaker-detail.dto';
import {
  PUBLIC_DEFAULT_PER_PAGE,
  PUBLIC_MAX_PER_PAGE,
  TOP_REQUESTED_LIMIT,
  publicSpeakerWhere,
} from '../public-speaker.constants';
import {
  PUBLIC_SPEAKER_DETAIL_SELECT,
  PUBLIC_SPEAKER_LIST_SELECT,
} from '../public-speaker.select';
import {
  toPublicDetailDto,
  toPublicListItemDto,
} from '../mappers/public-speaker.mapper';

const DEFAULT_ORDER_BY: Prisma.SpeakerOrderByWithRelationInput[] = [
  { isTopRequested: 'desc' },
  { isFeaturedHome: 'desc' },
  { lastName: 'asc' },
  { firstName: 'asc' },
];

@Injectable()
export class PublicSpeakersService {
  // Uniquement PrismaService — jamais SpeakersService (module admin) : ce
  // service construit ses propres requêtes avec `select` explicites, voir
  // public-speaker.select.ts (CLAUDE.md §5).
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryPublicSpeakersDto,
  ): Promise<PublicSpeakerListResponseDto> {
    const page = query.page ?? 1;
    const perPage = Math.min(
      query.perPage ?? PUBLIC_DEFAULT_PER_PAGE,
      PUBLIC_MAX_PER_PAGE,
    );
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.speaker.count({ where }),
      this.prisma.speaker.findMany({
        where,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * perPage,
        take: perPage,
        select: PUBLIC_SPEAKER_LIST_SELECT,
      }),
    ]);

    return {
      data: rows.map(toPublicListItemDto),
      meta: { total, page, perPage },
    };
  }

  // Renvoie aussi `speakerId` (usage interne UNIQUEMENT — voir le commentaire
  // sur PUBLIC_SPEAKER_DETAIL_SELECT.id) : PublicSpeakersController s'en sert
  // pour lier l'événement PROFILE_VIEW (Phase 3, §3a) au bon speaker, sans
  // jamais l'exposer dans la réponse HTTP (`detail` seul part au client).
  async findBySlug(
    slug: string,
  ): Promise<{ speakerId: number; detail: PublicSpeakerDetailDto }> {
    const speaker = await this.prisma.speaker.findFirst({
      where: { ...publicSpeakerWhere(), slug },
      select: PUBLIC_SPEAKER_DETAIL_SELECT,
    });

    // 404 générique, jamais 403 : un speaker DRAFT/masqué/archivé doit être
    // indiscernable d'un slug qui n'a jamais existé (voir CLAUDE.md §5).
    if (!speaker) {
      throw new NotFoundException('Speaker introuvable.');
    }

    // Le filtre "uniquement APPROVED + non supprimé" est déjà appliqué au
    // niveau du select (voir PUBLIC_SPEAKER_DETAIL_SELECT.media) : table
    // unique depuis la consolidation Phase 2, Partie A, plus besoin d'une
    // seconde requête ici.
    return { speakerId: speaker.id, detail: toPublicDetailDto(speaker) };
  }

  async findTopRequested(): Promise<PublicSpeakerListItemDto[]> {
    const rows = await this.prisma.speaker.findMany({
      where: {
        ...publicSpeakerWhere(),
        slug: { not: null },
        isTopRequested: true,
      },
      orderBy: [
        { isFeaturedHome: 'desc' },
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
      take: TOP_REQUESTED_LIMIT,
      select: PUBLIC_SPEAKER_LIST_SELECT,
    });

    return rows.map(toPublicListItemDto);
  }

  // §A — voir l'allow-list fermée sur QueryPublicSpeakersDto. `sortBy`
  // absent = comportement inchangé (DEFAULT_ORDER_BY, celui d'avant cette
  // étape) : aucune régression pour un appelant qui n'envoie jamais ce
  // paramètre.
  private buildOrderBy(
    query: QueryPublicSpeakersDto,
  ): Prisma.SpeakerOrderByWithRelationInput[] {
    if (!query.sortBy) {
      return DEFAULT_ORDER_BY;
    }
    switch (query.sortBy) {
      case PublicSpeakerSortBy.NAME: {
        const order = query.sortOrder ?? PublicSortOrder.ASC;
        return [{ lastName: order }, { firstName: order }];
      }
      case PublicSpeakerSortBy.PUBLISHED_AT: {
        // Plus récent en premier par défaut — c'est l'attente naturelle
        // d'un tri "par date de publication" sur une liste publique.
        const order = query.sortOrder ?? PublicSortOrder.DESC;
        return [{ publishedAt: order }];
      }
    }
  }

  private buildWhere(query: QueryPublicSpeakersDto): Prisma.SpeakerWhereInput {
    const where: Prisma.SpeakerWhereInput = {
      ...publicSpeakerWhere(),
      slug: { not: null },
    };

    if (query.q) {
      const q = query.q;
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { publicName: { contains: q } },
        { professionalTitle: { contains: q } },
        { expertiseSummary: { contains: q } },
        { keywords: { some: { keyword: { contains: q } } } },
      ];
    }
    if (query.pillar) {
      where.pillars = { some: { pillar: { slug: query.pillar } } };
    }
    if (query.theme) {
      where.themes = { some: { theme: { slug: query.theme } } };
    }
    if (query.country) {
      where.country = { iso2: query.country };
    }
    if (query.language) {
      where.languages = { some: { language: { code: query.language } } };
    }
    if (query.format) {
      where.formats = { some: { format: { slug: query.format } } };
    }
    if (query.feeTier) {
      where.feeTierPublic = query.feeTier;
    }

    return where;
  }
}
