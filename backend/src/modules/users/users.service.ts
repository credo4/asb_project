import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { MailService } from '../../mail/mail.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { DEFAULT_INVITATION_TOKEN_TTL_DAYS } from '../roster-applications/roster-application.constants';
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateUserInviteDto } from './dto/create-user-invite.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import {
  UserDetailDto,
  UserListResponseDto,
} from './dto/outputs/user-admin.dto';

// Périmètre de ce module : uniquement les comptes ADMIN/SUPER_ADMIN (§A1,
// "gestion des utilisateurs" = l'équipe, pas les comptes SPEAKER — ceux-là
// ont leur propre cycle de vie via la conversion de candidature, Phase 3c,
// et ne passent JAMAIS par ici). Toute requête (liste, lecture, écriture)
// filtre donc explicitement sur ces deux rôles ; un id qui existe mais
// pointe vers un compte SPEAKER se comporte comme s'il n'existait pas.
const TEAM_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  SPEAKER: 'Speaker',
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  updatePasswordHash(userId: number, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  markEmailVerified(userId: number): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  touchLastLogin(userId: number): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  // -----------------------------------------------------------------
  // ADMIN — CRUD équipe (§A1)
  // -----------------------------------------------------------------

  async findAllForAdmin(query: QueryUsersDto): Promise<UserListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;

    // `role` filtré par le client doit rester DANS le périmètre équipe :
    // ?role=SPEAKER ne doit jamais faire fuir un compte speaker ici.
    if (query.role && !TEAM_ROLES.includes(query.role)) {
      return { data: [], meta: { total: 0, page, perPage } };
    }

    const where: Prisma.UserWhereInput = {
      role: query.role ? query.role : { in: TEAM_ROLES },
      status: query.status,
      OR: query.search
        ? [
            { email: { contains: query.search } },
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
          ]
        : undefined,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toListItemDto),
      meta: { total, page, perPage },
    };
  }

  async findOneForAdmin(id: number): Promise<UserDetailDto> {
    const user = await this.findTeamMember(id);
    return toDetailDto(user);
  }

  // §A1 — création PAR INVITATION uniquement : réutilise le mécanisme de
  // token de la 3c (RosterApplicationsService#convert/resendInvitation)
  // plutôt que d'inventer un second système — un administrateur ne définit
  // JAMAIS le mot de passe d'un autre. `POST /auth/accept-invitation`
  // (déjà générique, voir InvitationAcceptController) valide et active le
  // compte, exactement comme pour un speaker converti.
  async invite(
    dto: CreateUserInviteDto,
    actor: AuthenticatedUser,
  ): Promise<{ id: number; email: string; invitationSent: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(`Un compte existe déjà pour ${dto.email}.`);
    }

    const { user, token } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          status: UserStatus.INVITED,
        },
      });

      // Token persisté DANS la transaction (écriture DB rapide) ;
      // l'envoi de l'email, lui, a lieu APRÈS le commit — voir plus bas
      // et CLAUDE.md §10 ("aucun envoi d'email dans une transaction").
      const invitationToken = randomBytes(32).toString('hex');
      const ttlDays = this.config.get<number>(
        'INVITATION_TOKEN_TTL_DAYS',
        DEFAULT_INVITATION_TOKEN_TTL_DAYS,
      );
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
      await tx.invitationToken.create({
        data: { userId: created.id, token: invitationToken, expiresAt },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'user.invited',
        entityType: 'User',
        entityId: created.id,
        newValue: { email: created.email, role: created.role },
      });

      return { user: created, token: invitationToken };
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    const invitationUrl = `${frontendUrl}/accept-invitation?token=${token}`;
    let invitationSent = true;
    try {
      await this.mailService.sendAdminUserInvitation({
        to: user.email,
        firstName: user.firstName ?? user.email,
        roleLabel: ROLE_LABELS[user.role],
        invitationUrl,
        relatedEntityId: user.id,
      });
    } catch {
      invitationSent = false;
    }

    return { id: user.id, email: user.email, invitationSent };
  }

  // §A1 GARDE-FOUS OBLIGATOIRES (portés ici, pas dans le controller, pour
  // qu'aucun futur appelant ne puisse les contourner) :
  //   1. on ne peut pas modifier son propre rôle ;
  //   2. on ne peut pas rétrograder le DERNIER SUPER_ADMIN actif.
  // La désactivation (garde-fous 2 et 3 côté "on ne peut pas se
  // désactiver/désactiver le dernier SUPER_ADMIN") vit dans deactivate()
  // ci-dessous, endpoint séparé — voir DeactivateUserDto.
  async update(
    id: number,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ): Promise<UserDetailDto> {
    const target = await this.findTeamMember(id);

    if (dto.role !== undefined && dto.role !== target.role) {
      if (target.id === actor.id) {
        throw new BadRequestException(
          'Vous ne pouvez pas modifier votre propre rôle.',
        );
      }
      if (target.role === Role.SUPER_ADMIN && dto.role !== Role.SUPER_ADMIN) {
        await this.assertNotLastActiveSuperAdmin(target.id);
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.role !== undefined) data.role = dto.role;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data });
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'user.updated',
        entityType: 'User',
        entityId: id,
        oldValue: scalarSnapshot(target),
        newValue: scalarSnapshot(row),
      });
      return row;
    });

    return toDetailDto(updated);
  }

  // §A1 GARDE-FOUS 2 et 3 + réassignation obligatoire.
  async deactivate(
    id: number,
    dto: DeactivateUserDto,
    actor: AuthenticatedUser,
  ): Promise<UserDetailDto> {
    const target = await this.findTeamMember(id);

    if (target.id === actor.id) {
      throw new BadRequestException(
        'Vous ne pouvez pas désactiver votre propre compte.',
      );
    }
    if (target.status === UserStatus.DISABLED) {
      // Idempotent : déjà désactivé, rien à refaire.
      return toDetailDto(target);
    }
    if (target.role === Role.SUPER_ADMIN) {
      await this.assertNotLastActiveSuperAdmin(target.id);
    }

    const [bookingCount, applicationCount, orgCount] = await Promise.all([
      this.prisma.bookingRequest.count({ where: { assignedAdminId: id } }),
      this.prisma.rosterApplication.count({
        where: { assignedAdminId: id },
      }),
      this.prisma.organization.count({ where: { assignedAdminId: id } }),
    ]);
    const assignedTotal = bookingCount + applicationCount + orgCount;

    let reassignTo: User | null = null;
    if (assignedTotal > 0) {
      if (dto.release && dto.reassignToUserId) {
        throw new BadRequestException(
          'Choisis soit "libérer", soit "réassigner à", pas les deux.',
        );
      }
      if (!dto.release && !dto.reassignToUserId) {
        throw new BadRequestException(
          `${target.email} a ${assignedTotal} élément(s) assigné(s) ` +
            `(${bookingCount} demande(s), ${applicationCount} candidature(s), ` +
            `${orgCount} organisation(s)) : indique reassignToUserId ou release:true.`,
        );
      }
      if (dto.reassignToUserId) {
        reassignTo = await this.prisma.user.findFirst({
          where: {
            id: dto.reassignToUserId,
            role: { in: TEAM_ROLES },
            status: UserStatus.ACTIVE,
          },
        });
        if (!reassignTo) {
          throw new BadRequestException(
            `Destinataire ${dto.reassignToUserId} introuvable ou inactif.`,
          );
        }
        if (reassignTo.id === target.id) {
          throw new BadRequestException(
            'Le destinataire ne peut pas être le compte désactivé lui-même.',
          );
        }
      }
    }

    const newAssigneeId = dto.release ? null : (reassignTo?.id ?? undefined);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (assignedTotal > 0) {
        await tx.bookingRequest.updateMany({
          where: { assignedAdminId: id },
          data: { assignedAdminId: newAssigneeId },
        });
        await tx.rosterApplication.updateMany({
          where: { assignedAdminId: id },
          data: { assignedAdminId: newAssigneeId },
        });
        await tx.organization.updateMany({
          where: { assignedAdminId: id },
          data: { assignedAdminId: newAssigneeId },
        });
      }

      const row = await tx.user.update({
        where: { id },
        data: { status: UserStatus.DISABLED },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'user.deactivated',
        entityType: 'User',
        entityId: id,
        oldValue: { status: target.status },
        newValue: {
          status: row.status,
          assignedReassignedTo: newAssigneeId ?? null,
          assignedReleased: dto.release ? assignedTotal : 0,
        },
      });

      return row;
    });

    return toDetailDto(updated);
  }

  // -----------------------------------------------------------------
  // Mon compte (§A2) — PATCH /auth/me. Volontairement pas de re-vérification
  // d'email ici : `UpdateMeDto` n'expose ni `role` ni `status`, donc aucun
  // des garde-fous du §A1 n'entre en jeu — un utilisateur édite son propre
  // nom/email/préférences librement, sans passer par UsersService#update.
  // -----------------------------------------------------------------

  async updateOwnProfile(
    userId: number,
    dto: {
      firstName?: string;
      lastName?: string;
      email?: string;
      preferences?: Record<string, unknown>;
    },
  ): Promise<User> {
    if (dto.email !== undefined) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException(`Un compte existe déjà pour ${dto.email}.`);
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.preferences !== undefined) {
      data.preferences = dto.preferences as Prisma.InputJsonValue;
    }

    return this.prisma.user.update({ where: { id: userId }, data });
  }

  private async findTeamMember(id: number): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, role: { in: TEAM_ROLES } },
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable.`);
    }
    return user;
  }

  // §A1 — refuse de laisser tomber à zéro le nombre de SUPER_ADMIN ACTIFS
  // (hors le compte `excludeId` qu'on est en train de rétrograder/désactiver) :
  // "le scénario qui rend une application définitivement inadministrable."
  private async assertNotLastActiveSuperAdmin(
    excludeId: number,
  ): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: {
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        id: { not: excludeId },
      },
    });
    if (remaining === 0) {
      throw new BadRequestException(
        'Impossible : ce compte est le dernier SUPER_ADMIN actif.',
      );
    }
  }
}

function toListItemDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

function toDetailDto(user: User): UserDetailDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function scalarSnapshot(user: User): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
  };
}
