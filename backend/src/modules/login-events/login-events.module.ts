import { Module } from '@nestjs/common';
import { LoginEventsService } from './login-events.service';
import { LoginEventsController } from './login-events.controller';

@Module({
  controllers: [LoginEventsController],
  providers: [LoginEventsService],
  exports: [LoginEventsService],
})
export class LoginEventsModule {}
