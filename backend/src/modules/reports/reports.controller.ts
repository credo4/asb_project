import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { ReportsService } from './reports.service';
import {
  QueryReportsDto,
  QuerySpeakersReportDto,
} from './dto/query-reports.dto';
import { SpeakersReportDto } from './dto/outputs/speakers-report.dto';
import { CommercialReportDto } from './dto/outputs/commercial-report.dto';
import { EditorialReportDto } from './dto/outputs/editorial-report.dto';
import {
  commercialReportCsv,
  editorialReportCsv,
  speakersReportCsv,
} from './reports-csv.util';

// §A2/A4 — les 3 rapports (§14.1/14.2/14.3). Lecture ADMIN/SUPER_ADMIN pour
// les statistiques d'activité et éditoriales ; chiffre d'affaires et
// commission réservés SUPER_ADMIN — géré à l'intérieur du service (clés
// absentes du JSON pour un ADMIN, jamais juste masquées côté client), pas
// ici : ce contrôleur ne fait aucune vérification de rôle au-delà du guard
// commun, la logique d'omission de champ reste dans ReportsService.
@Controller('admin/reports')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // `@ApiOkResponse` explicite : le plugin CLI `@nestjs/swagger` infère le
  // schéma depuis le type de retour ANNOTÉ de la méthode (voir CLAUDE.md
  // §2b, même gotcha que TokenPairDto) — ici `Promise<XxxDto | void>` (le
  // second membre venant de la branche CSV, `@Res({ passthrough: true })`
  // + `return;`), une union que le plugin ne résout pas en schéma correct
  // (ressort `Record<string, never>` côté `types:generate`). Sans le
  // décorateur, le corps CSV (texte brut) ne peut de toute façon pas
  // partager un seul schéma JSON avec le corps JSON normal.
  @Get('speakers')
  @ApiOkResponse({ type: SpeakersReportDto })
  async getSpeakers(
    @Query() query: QuerySpeakersReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SpeakersReportDto | void> {
    const dto = await this.service.getSpeakersReport(query, user.role);
    if (query.format === 'csv') {
      const csv = speakersReportCsv(
        dto,
        query.table,
        user.role === Role.SUPER_ADMIN,
      );
      this.sendCsv(res, 'rapport-speakers', csv);
      return;
    }
    return dto;
  }

  @Get('commercial')
  @ApiOkResponse({ type: CommercialReportDto })
  async getCommercial(
    @Query() query: QueryReportsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CommercialReportDto | void> {
    const dto = await this.service.getCommercialReport(query, user.role);
    if (query.format === 'csv') {
      this.sendCsv(
        res,
        'rapport-commercial',
        commercialReportCsv(dto, query.table),
      );
      return;
    }
    return dto;
  }

  @Get('editorial')
  @ApiOkResponse({ type: EditorialReportDto })
  async getEditorial(
    @Query() query: QueryReportsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EditorialReportDto | void> {
    const dto = await this.service.getEditorialReport(query);
    if (query.format === 'csv') {
      this.sendCsv(
        res,
        'rapport-editorial',
        editorialReportCsv(dto, query.table),
      );
      return;
    }
    return dto;
  }

  private sendCsv(res: Response, baseName: string, csv: string): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseName}.csv"`,
    );
    res.send(csv);
  }
}
