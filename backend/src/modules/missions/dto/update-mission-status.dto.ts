import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, ValidateIf } from 'class-validator';
import { MissionStatus } from '@prisma/client';

// §3 — cancellationReason OBLIGATOIRE quand status = CANCELLED (validé ici
// via @ValidateIf plutôt qu'en base : cohérent avec le reste du projet, où
// une contrainte conditionnelle de ce type vit toujours côté DTO/service,
// jamais une contrainte SQL qui ne saurait pas s'exprimer proprement pour
// un champ nullable conditionnel en MySQL).
export class UpdateMissionStatusDto {
  @ApiProperty({ enum: MissionStatus })
  @IsEnum(MissionStatus)
  status!: MissionStatus;

  @ApiPropertyOptional({
    description: 'Obligatoire si status = CANCELLED.',
  })
  @ValidateIf(
    (dto: UpdateMissionStatusDto) => dto.status === MissionStatus.CANCELLED,
  )
  @IsString()
  @MaxLength(2000)
  cancellationReason?: string;
}
