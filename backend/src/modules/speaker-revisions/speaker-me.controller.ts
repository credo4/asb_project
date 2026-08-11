import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { SpeakerRevisionsService } from './speaker-revisions.service';
import { SpeakerRevisionPayloadDto } from './dto/speaker-revision-payload.dto';

// Aucune route ici n'accepte un identifiant de speaker ou de révision fourni
// par l'appelant : c'est le mécanisme de vérification de propriété — voir le
// commentaire au-dessus de SpeakerRevisionsService.getOwnSpeakerOrThrow.
@Controller('speaker/me')
@Roles(Role.SPEAKER)
export class SpeakerMeController {
  constructor(
    private readonly speakerRevisionsService: SpeakerRevisionsService,
  ) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.speakerRevisionsService.getOwnProfile(user);
  }

  @Get('revision')
  getRevision(@CurrentUser() user: AuthenticatedUser) {
    return this.speakerRevisionsService.getOwnRevision(user);
  }

  @Put('revision')
  saveRevision(
    @Body() dto: SpeakerRevisionPayloadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.speakerRevisionsService.saveOwnDraft(user, dto);
  }

  @Post('revision/submit')
  @HttpCode(HttpStatus.OK)
  submitRevision(@CurrentUser() user: AuthenticatedUser) {
    return this.speakerRevisionsService.submitOwnRevision(user);
  }

  @Post('revision/withdraw')
  @HttpCode(HttpStatus.OK)
  withdrawRevision(@CurrentUser() user: AuthenticatedUser) {
    return this.speakerRevisionsService.withdrawOwnRevision(user);
  }

  @Get('revision/preview')
  previewRevision(@CurrentUser() user: AuthenticatedUser) {
    return this.speakerRevisionsService.previewOwnRevision(user);
  }
}
