import { AdminRefDto } from './reference.dto';

export class ReminderDto {
  id!: number;
  dueAt!: Date;
  assignedTo!: AdminRefDto | null;
  message!: string;
  doneAt!: Date | null;
  createdBy!: AdminRefDto | null;
  createdAt!: Date;
}
