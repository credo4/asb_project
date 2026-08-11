import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivityLogEntry {
  // `null` = action système (ex. création via un formulaire public, sans
  // utilisateur authentifié) — cf. le commentaire sur `actorId` dans
  // prisma/schema.prisma (`ActivityLog.actorId`).
  actorId: number | null;
  action: string;
  entityType: string;
  entityId: number;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  // Accepte soit le PrismaService normal, soit un client de transaction
  // (`tx` dans `prisma.$transaction(async (tx) => ...)`) : les deux ont la
  // même forme pour `activityLog.create`. Ça permet à l'appelant de faire
  // écrire le journal DANS la même transaction que le changement métier —
  // si l'un échoue, l'autre est annulé aussi (cohérence garantie).
  async record(
    client: Prisma.TransactionClient,
    entry: ActivityLogEntry,
  ): Promise<void> {
    await client.activityLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: toJsonInput(entry.oldValue),
        newValue: toJsonInput(entry.newValue),
        ipAddress: entry.ipAddress,
      },
    });
  }
}

// Les valeurs peuvent contenir des types non-JSON natifs (Decimal, Date) :
// on repasse par un cycle JSON pour garantir une valeur strictement
// sérialisable avant de l'écrire dans la colonne JSON.
function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
