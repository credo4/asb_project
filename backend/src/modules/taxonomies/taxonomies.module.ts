import { Module } from '@nestjs/common';
import { AdminTaxonomiesController } from './admin-taxonomies.controller';
import { AdminTaxonomiesService } from './admin-taxonomies.service';

@Module({
  controllers: [AdminTaxonomiesController],
  providers: [AdminTaxonomiesService],
})
export class TaxonomiesModule {}
