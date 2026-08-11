import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role, UserStatus } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';

interface AccessTokenPayload {
  sub: number;
  email: string;
  role: Role;
}

// `PassportStrategy(Strategy, 'jwt')` déclare une stratégie nommée 'jwt' que
// JwtAuthGuard active via `AuthGuard('jwt')`. Passport appelle `validate()`
// automatiquement une fois la signature/expiration du token vérifiées ; ce
// qu'on retourne ici devient `request.user`.
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Compte introuvable ou inactif');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
