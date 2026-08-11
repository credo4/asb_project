import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h
// bcryptjs (implémentation pure JS, sans compilation native) plutôt
// qu'argon2 : certains hébergements mutualisés (ex. Hostinger Node.js
// hosting) ont un Python trop ancien pour compiler node-gyp, ce qui casse
// argon2 à l'installation. CLAUDE.md acceptait déjà "argon2 (ou bcrypt)".
// Exporté : réutilisé par RosterApplicationsService#acceptInvitation (Phase
// 3c) pour hacher le mot de passe défini à l'acceptation d'une invitation —
// même politique de coût partout, pas de valeur dupliquée qui pourrait dériver.
export const BCRYPT_COST_FACTOR = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(dto.email);

    // Même message que le mot de passe soit faux ou l'utilisateur inexistant
    // (ne jamais révéler quel élément a échoué — anti-enumeration).
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte inactif');
    }

    await this.usersService.touchLastLogin(user.id);
    return this.issueTokenPair(user);
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');

    let payload: { sub: number };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: number }>(
        refreshToken,
        { secret: refreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    const isValid =
      stored &&
      !stored.revokedAt &&
      stored.expiresAt > new Date() &&
      stored.userId === payload.sub;

    if (!stored || !isValid) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const user = await this.usersService.findById(stored.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte introuvable ou inactif');
    }

    // Rotation : l'ancien refresh token est révoqué avant d'en émettre un
    // nouveau — s'il est réutilisé (vol/replay), il sera désormais rejeté.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user);
  }

  async sendEmailVerification(user: User): Promise<void> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const verificationUrl = `${this.config.get<string>('FRONTEND_URL')}/verify-email?token=${token}`;

    // Le token est déjà en base : un échec d'envoi ne doit pas faire échouer
    // la création du compte (l'admin pourra renvoyer le lien plus tard).
    try {
      await this.mailService.sendEmailVerification(
        user.email,
        user.firstName,
        verificationUrl,
        user.id,
      );
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de l'email de vérification à ${user.email}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token: dto.token },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Lien de vérification invalide ou expiré',
      );
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    return { message: 'Adresse email vérifiée avec succès.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    // Réponse générique dans tous les cas : ne jamais révéler si l'email
    // correspond à un compte existant.
    const generic = {
      message:
        "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.",
    };

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return generic;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = `${this.config.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;

    // Un échec d'envoi ne doit JAMAIS changer la réponse renvoyée : sinon un
    // 500 ici (vs 200 pour un email inconnu) devient un oracle d'énumération
    // de comptes, ce que `generic` est censé empêcher.
    try {
      await this.mailService.sendPasswordReset(
        user.email,
        user.firstName,
        resetUrl,
        user.id,
      );
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de l'email de réinitialisation à ${user.email}`,
        error instanceof Error ? error.stack : error,
      );
    }

    return generic;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Lien de réinitialisation invalide ou expiré',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST_FACTOR);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      // Un changement de mot de passe invalide toutes les sessions actives.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  // Enveloppe publique de issueTokenPair — réutilisée par
  // RosterApplicationsService#acceptInvitation (Phase 3c) : "connecte
  // l'utilisateur" à l'acceptation d'une invitation suit exactement la même
  // logique qu'un login (paire de tokens + refresh token persisté), pas de
  // raison de la dupliquer.
  async issueTokenPairForUser(user: User): Promise<TokenPair> {
    return this.issueTokenPair(user);
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    // `jti` (JWT ID) garantit un token unique même émis dans la même
    // seconde : sans lui, deux tokens signés au même `iat` avec les mêmes
    // claims sont octet pour octet identiques (JWT = signature déterministe),
    // ce qui fait échouer la contrainte d'unicité sur le hash en base lors
    // d'une rotation rapprochée (login puis refresh quasi simultanés).
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomBytes(16).toString('hex'),
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn as import('ms').StringValue,
    });

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  // sha256 suffit : ce sont des tokens à haute entropie (générés par JWT),
  // pas des mots de passe à faible entropie — inutile d'y mettre argon2.
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
