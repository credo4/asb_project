import {
  RosterApplicationDetailRow,
  RosterApplicationListRow,
  RosterApplicationRow,
} from '../roster-applications.includes';
import { RosterApplicationListItemDto } from '../dto/roster-application-list-item.dto';
import { RosterApplicationDetailDto } from '../dto/roster-application-detail.dto';
import { RosterApplicationEvaluationDto } from '../dto/outputs/evaluation.dto';
import { RosterApplicationAttachmentDto } from '../dto/outputs/attachment.dto';
import {
  AdminRefDto,
  ConvertedSpeakerRefDto,
  ConvertedUserRefDto,
} from '../dto/outputs/reference.dto';
import { computeAggregatedScore } from '../aggregated-score.util';
import { EmailDeliverySummaryDto } from '../../../mail/dto/outputs/email-delivery-item.dto';

export function toAdminRef(
  admin: RosterApplicationRow['assignedAdmin'],
): AdminRefDto | null {
  if (!admin) return null;
  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
  };
}

export function toConvertedSpeakerRef(
  speaker: RosterApplicationRow['convertedSpeaker'],
): ConvertedSpeakerRefDto | null {
  if (!speaker) return null;
  return {
    id: speaker.id,
    displayName:
      speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`,
    slug: speaker.slug,
  };
}

export function toConvertedUserRef(
  user: RosterApplicationRow['convertedUser'],
): ConvertedUserRefDto | null {
  if (!user) return null;
  return { id: user.id, email: user.email, status: user.status };
}

export function toEvaluationDto(
  row: RosterApplicationDetailRow['evaluations'][number],
): RosterApplicationEvaluationDto {
  return {
    id: row.id,
    evaluator: toAdminRef(row.evaluator),
    expertiseLevel: row.expertiseLevel,
    professionalCredibility: row.professionalCredibility,
    stageExperience: row.stageExperience,
    speakingQuality: row.speakingQuality,
    internationalRelevance: row.internationalRelevance,
    languageProficiency: row.languageProficiency,
    mediaQuality: row.mediaQuality,
    pillarFit: row.pillarFit,
    commercialPotential: row.commercialPotential,
    comment: row.comment,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toAttachmentDto(
  row: RosterApplicationDetailRow['attachments'][number],
): RosterApplicationAttachmentDto {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: toAdminRef(row.uploadedBy),
    uploadedAt: row.uploadedAt,
  };
}

export function toListItemDto(
  row: RosterApplicationListRow,
  hasDuplicateEmail: boolean,
): RosterApplicationListItemDto {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,

    fullName: row.fullName,
    jobTitle: row.jobTitle,
    organization: row.organization,
    country: row.country,
    expertiseArea: row.expertiseArea,
    linkedinUrl: row.linkedinUrl,
    workEmail: row.workEmail,

    assignedAdmin: toAdminRef(row.assignedAdmin),
    aggregatedScore: computeAggregatedScore(row.evaluations),
    hasDuplicateEmail,

    createdAt: row.createdAt,
  };
}

export function toDetailDto(
  row: RosterApplicationDetailRow,
  hasDuplicateEmail: boolean,
  emailDeliveries: EmailDeliverySummaryDto[],
): RosterApplicationDetailDto {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    statusChangedAt: row.statusChangedAt,

    fullName: row.fullName,
    jobTitle: row.jobTitle,
    organization: row.organization,
    country: row.country,
    workEmail: row.workEmail,
    phone: row.phone,
    linkedinUrl: row.linkedinUrl,
    expertiseArea: row.expertiseArea,
    keyTopics: row.keyTopics,
    message: row.message,
    gdprConsent: row.gdprConsent,

    assignedAdmin: toAdminRef(row.assignedAdmin),
    interviewScheduledAt: row.interviewScheduledAt,
    interviewNotes: row.interviewNotes,
    rejectionReason: row.rejectionReason,

    evaluations: row.evaluations.map(toEvaluationDto),
    aggregatedScore: computeAggregatedScore(row.evaluations),

    attachments: row.attachments.map(toAttachmentDto),
    emailDeliveries,

    hasDuplicateEmail,

    convertedSpeaker: toConvertedSpeakerRef(row.convertedSpeaker),
    convertedUser: toConvertedUserRef(row.convertedUser),
    convertedAt: row.convertedAt,

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function scalarSnapshot(
  row: RosterApplicationRow,
): Record<string, unknown> {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    assignedAdminId: row.assignedAdminId,
    convertedUserId: row.convertedUserId,
    convertedSpeakerId: row.convertedSpeakerId,
    updatedAt: row.updatedAt,
  };
}
