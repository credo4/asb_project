import { Injectable } from '@nestjs/common';
import { PillarStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PublicPillarDto } from '../dto/public-pillar.dto';
import {
  PublicCountryRefDto,
  PublicFormatRefDto,
  PublicLanguageRefDto,
} from '../dto/outputs/reference.dto';
import { publicSpeakerWhere } from '../public-speaker.constants';

@Injectable()
export class PublicTaxonomiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPillars(): Promise<PublicPillarDto[]> {
    const pillars = await this.prisma.pillar.findMany({
      where: { status: PillarStatus.PUBLISHED },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        imageUrl: true,
        intro: true,
        problemStatement: true,
        valueProposition: true,
        themes: {
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true, slug: true },
        },
      },
    });
    return pillars;
  }

  async findFormats(): Promise<PublicFormatRefDto[]> {
    return this.prisma.format.findMany({
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }

  async findLanguages(): Promise<PublicLanguageRefDto[]> {
    return this.prisma.language.findMany({
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }

  // Uniquement les pays ayant au moins un speaker publié (évite d'afficher
  // des filtres qui ne renverraient jamais aucun résultat).
  async findCountriesWithPublishedSpeakers(): Promise<PublicCountryRefDto[]> {
    return this.prisma.country.findMany({
      where: { residents: { some: publicSpeakerWhere() } },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, iso2: true },
    });
  }
}
