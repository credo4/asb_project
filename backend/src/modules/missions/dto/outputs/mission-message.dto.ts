import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class MissionMessageDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: Role })
  authorRole!: Role;

  @ApiPropertyOptional({ nullable: true })
  authorEmail!: string | null;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  createdAt!: string;
}
