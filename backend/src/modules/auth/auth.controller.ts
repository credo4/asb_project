import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateMeDto } from '../users/dto/update-me.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { MeResponseDto } from './dto/outputs/me.dto';
import { TokenPairDto } from './dto/outputs/token-pair.dto';
import { toMeResponseDto } from './mappers/auth.mapper';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // anti-bruteforce
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<TokenPairDto> {
    return this.authService.login(dto, {
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairDto> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  // PAS @Public() : exige un access token valide (JwtAuthGuard global) —
  // c'est tout le point de cet endpoint, renvoyer le profil du porteur du
  // token, jamais un profil arbitraire.
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponseDto> {
    return this.authService.me(user.id);
  }

  // §A2 — auto-édition (nom/email/préférences), jamais rôle/statut (voir
  // UpdateMeDto, qui ne les expose même pas).
  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ): Promise<MeResponseDto> {
    const updated = await this.usersService.updateOwnProfile(user.id, dto);
    return toMeResponseDto(updated);
  }

  // §A2 — exige le mot de passe actuel, invalide les autres sessions (voir
  // AuthService#changePassword pour le détail).
  @HttpCode(HttpStatus.OK)
  @Post('me/change-password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<TokenPairDto> {
    return this.authService.changePassword(user.id, dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // anti-abus (spam d'emails)
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
