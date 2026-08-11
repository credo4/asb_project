import { AdminRefDto } from './reference.dto';

export class BookingRequestNoteDto {
  id!: number;
  body!: string;
  author!: AdminRefDto | null;
  createdAt!: Date;
}
