import {
  CuratedListDetailRow,
  CuratedListListRow,
} from '../curated-lists.includes';
import { CuratedListListItemDto } from '../dto/outputs/curated-list-list-item.dto';
import { CuratedListDetailDto } from '../dto/outputs/curated-list-detail.dto';
import { CuratedListMemberDto } from '../dto/outputs/curated-list-member.dto';

function displayNameOf(speaker: {
  publicName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`;
}

export function toListItemDto(row: CuratedListListRow): CuratedListListItemDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    displayOrder: row.displayOrder,
    memberCount: row._count.members,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMemberDto(
  member: CuratedListDetailRow['members'][number],
): CuratedListMemberDto {
  return {
    speakerId: member.speakerId,
    displayName: displayNameOf(member.speaker),
    slug: member.speaker.slug,
    status: member.speaker.status,
    isVisible: member.speaker.isVisible,
    displayOrder: member.displayOrder,
  };
}

export function toDetailDto(row: CuratedListDetailRow): CuratedListDetailDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    displayOrder: row.displayOrder,
    status: row.status,
    publishedAt: row.publishedAt,
    selectionMode: row.selectionMode,
    members: row.members.map(toMemberDto),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function scalarSnapshot(row: {
  id: number;
  title: string;
  slug: string;
  status: string;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}
