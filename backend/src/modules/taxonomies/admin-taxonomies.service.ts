import { Injectable } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CountryRefDto,
  FormatRefDto,
  LanguageRefDto,
  PillarRefDto,
  ThemeRefDto,
} from '../speakers/dto/outputs/reference.dto';
import { AdminRefDto } from '../booking-requests/dto/outputs/reference.dto';

// Listes de RÉFÉRENCE complètes, pour peupler les sélecteurs des écrans
// admin (formulaire speaker, filtres de liste) — DISTINCT de
// PublicTaxonomiesService (modules/public/taxonomies) : celui-ci filtre
// délibérément sur ce qui a déjà au moins un speaker PUBLISHED (n'afficher
// que des filtres publics qui renvoient du résultat) — inutilisable côté
// admin, où il faut pouvoir choisir un pilier/pays qui n'a encore AUCUN
// speaker publié (le tout premier profil pour ce pilier, par exemple).
@Injectable()
export class AdminTaxonomiesService {
  constructor(private readonly prisma: PrismaService) {}

  // Tous les piliers, quel que soit leur PillarStatus (DRAFT/PUBLISHED) : ce
  // statut décrit le contenu CMS de la page publique du pilier lui-même,
  // pas s'il est assignable à un speaker.
  async findPillars(): Promise<PillarRefDto[]> {
    return this.prisma.pillar.findMany({
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }

  async findThemes(): Promise<ThemeRefDto[]> {
    return this.prisma.theme.findMany({
      orderBy: [{ pillarId: 'asc' }, { displayOrder: 'asc' }],
      select: { id: true, name: true, slug: true, pillarId: true },
    });
  }

  async findFormats(): Promise<FormatRefDto[]> {
    return this.prisma.format.findMany({
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }

  async findLanguages(): Promise<LanguageRefDto[]> {
    return this.prisma.language.findMany({
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }

  async findCountries(): Promise<CountryRefDto[]> {
    return this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, iso2: true },
    });
  }

  // Liste de RÉFÉRENCE (id/nom), pour peupler un sélecteur d'assignation
  // (demandes clients, candidatures...) — PAS de la gestion d'utilisateurs
  // (CRUD complet, création/désactivation de comptes) : explicitement hors
  // périmètre du chantier back-office en cours. Comptes ACTIVE uniquement —
  // assigner une demande à un compte suspendu n'aurait aucun sens.
  async findAdmins(): Promise<AdminRefDto[]> {
    return this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        status: UserStatus.ACTIVE,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }
}
