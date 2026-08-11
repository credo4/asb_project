import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';

// Racine de stockage, résolue une seule fois de la même façon partout
// (LocalDiskStorageService ET ServeStaticModule doivent pointer vers le
// même dossier physique, sinon les fichiers écrits ne seraient pas ceux servis).
export function resolveStorageRoot(config: ConfigService): string {
  const configuredRoot = config.get<string>('STORAGE_ROOT', './storage');
  return resolve(configuredRoot);
}
