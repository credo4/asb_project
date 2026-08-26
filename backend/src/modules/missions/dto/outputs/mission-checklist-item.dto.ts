import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MissionChecklistItemDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  displayOrder!: number;

  @ApiProperty()
  isDone!: boolean;

  @ApiPropertyOptional({ nullable: true })
  doneAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  doneByEmail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;
}
