import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildPublicApiDocument } from '../src/app.config';

// Génère un export STATIQUE de la doc Swagger de l'API publique (JSON
// OpenAPI), à héberger tel quel (avec swagger-static/index.html) sur
// n'importe quel hébergement statique (Hostinger, Netlify, etc.) — aucun
// backend requis côté hébergement. Ne documente que /public/* (voir
// buildPublicApiDocument dans app.config.ts).
//
// Usage : npm run docs:export (depuis backend/)
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildPublicApiDocument(app);

  const outDir = join(__dirname, '..', 'swagger-static');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'openapi.json'),
    JSON.stringify(document, null, 2),
  );

  console.log(`[docs:export] OK -> ${join(outDir, 'openapi.json')}`);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
