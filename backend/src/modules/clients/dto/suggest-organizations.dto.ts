import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SuggestOrganizationsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(250)
  name!: string;
}
