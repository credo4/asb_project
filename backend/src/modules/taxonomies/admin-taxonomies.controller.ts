import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminTaxonomiesService } from './admin-taxonomies.service';

// Préfixe `admin/taxonomies/*`, jamais `admin/pillars` etc. : ce dernier est
// le nom que la Phase 4 (CMS, pages/piliers éditables) voudra très
// probablement pour un CRUD complet des piliers — pas question de le
// squatter ici pour un simple GET de référence en lecture seule.
@Controller('admin/taxonomies')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminTaxonomiesController {
  constructor(private readonly taxonomiesService: AdminTaxonomiesService) {}

  @Get('pillars')
  findPillars() {
    return this.taxonomiesService.findPillars();
  }

  @Get('themes')
  findThemes() {
    return this.taxonomiesService.findThemes();
  }

  @Get('formats')
  findFormats() {
    return this.taxonomiesService.findFormats();
  }

  @Get('languages')
  findLanguages() {
    return this.taxonomiesService.findLanguages();
  }

  @Get('countries')
  findCountries() {
    return this.taxonomiesService.findCountries();
  }

  // Pas de la gestion d'utilisateurs (hors périmètre) -- juste de quoi
  // peupler un sélecteur d'assignation (nom + id), comme les autres routes
  // de ce contrôleur.
  @Get('admins')
  findAdmins() {
    return this.taxonomiesService.findAdmins();
  }
}
