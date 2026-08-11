import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MediaReviewStatus } from '@prisma/client';

export class ReviewMediaDto {
  // @IsIn restreint aux deux valeurs valables à l'exécution ; DRAFT/PENDING_REVIEW
  // n'a pas de sens comme verdict de revue.
  @IsIn([MediaReviewStatus.APPROVED, MediaReviewStatus.REJECTED])
  status!: MediaReviewStatus;

  @ValidateIf((o: ReviewMediaDto) => o.status === MediaReviewStatus.REJECTED)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rejectionReason?: string;
}
