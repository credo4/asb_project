import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// `@Global()` rend ce module disponible partout sans avoir à le ré-importer
// dans chaque module métier (auth, speakers, ...) : on n'a qu'un seul
// PrismaService injecté dans toute l'app, comme demandé par CLAUDE.md.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
