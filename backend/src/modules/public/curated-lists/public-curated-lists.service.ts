import { Injectable, NotFoundException } from '@nestjs/common';
import { CuratedListStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { publicSpeakerWhere } from '../public-speaker.constants';
import { PUBLIC_SPEAKER_LIST_SELECT } from '../public-speaker.select';
import { toPublicListItemDto } from '../mappers/public-speaker.mapper';
import { PublicCuratedListListItemDto } from '../dto/public-curated-list-list-item.dto';
import { PublicCuratedListDetailDto } from '../dto/public-curated-list-detail.dto';

const LIST_ITEM_SELECT = {
  slug: true,
  title: true,
  description: true,
  imageUrl: true,
  displayOrder: true,
} as const;

@Injectable()
export class PublicCuratedListsService {
  // Uniquement PrismaService — même principe que PublicSpeakersService
  // (CLAUDE.md §5) : ce module ne dépend jamais du module admin
  // curated-lists, requêtes propres avec `select` explicites.
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PublicCuratedListListItemDto[]> {
    return this.prisma.curatedList.findMany({
      where: { status: CuratedListStatus.PUBLISHED, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
      select: LIST_ITEM_SELECT,
    });
  }

  // §B4 — RÈGLE CRITIQUE : le filtre "speaker publié et visible" est dans
  // le `where` de la relation `members` ci-dessous, donc dans la requête
  // SQL elle-même — un membre DRAFT/masqué n'est même pas récupéré depuis
  // la base, pas juste caché après coup (même philosophie que `select`
  // plutôt que `include` + filtrage JS ailleurs dans ce module).
  async findBySlug(
    slug: string,
  ): Promise<{ curatedListId: number; detail: PublicCuratedListDetailDto }> {
    const list = await this.prisma.curatedList.findFirst({
      where: { status: CuratedListStatus.PUBLISHED, deletedAt: null, slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        imageUrl: true,
        members: {
          where: {
            speaker: { ...publicSpeakerWhere(), slug: { not: null } },
          },
          orderBy: { displayOrder: 'asc' },
          select: { speaker: { select: PUBLIC_SPEAKER_LIST_SELECT } },
        },
      },
    });

    // 404 générique, jamais 403 — même règle que les speakers (CLAUDE.md §5) :
    // une liste DRAFT/supprimée doit être indiscernable d'un slug inexistant.
    if (!list) {
      throw new NotFoundException('Liste éditoriale introuvable.');
    }

    return {
      curatedListId: list.id,
      detail: {
        slug: list.slug,
        title: list.title,
        description: list.description,
        imageUrl: list.imageUrl,
        // Réutilise le mapper public des speakers TEL QUEL (§B4) — jamais
        // une seconde projection qui pourrait diverger.
        speakers: list.members.map((m) => toPublicListItemDto(m.speaker)),
      },
    };
  }
}
