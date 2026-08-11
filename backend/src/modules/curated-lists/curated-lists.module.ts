import { Module } from '@nestjs/common';
import { CuratedListsController } from './curated-lists.controller';
import { CuratedListsService } from './curated-lists.service';

@Module({
  controllers: [CuratedListsController],
  providers: [CuratedListsService],
  exports: [CuratedListsService],
})
export class CuratedListsModule {}
