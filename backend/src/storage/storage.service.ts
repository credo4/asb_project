import { Readable } from 'stream';

// Abstraction du stockage de fichiers. Le code métier (ex: MediaController)
// dépend UNIQUEMENT de cette classe abstraite, jamais de `fs`/du disque
// directement — on peut ainsi remplacer LocalDiskStorageService par une
// implémentation S3/Cloud plus tard sans toucher au reste de l'app (il
// suffira de changer le `useClass` dans StorageModule).
//
// Convention de "clé" : chaque clé retournée par savePublic/savePrivate est
// préfixée par son espace ("public/..." ou "private/..."), ce qui permet à
// getPublicUrl/streamPrivate/delete de savoir sans ambiguïté d'où vient le
// fichier et d'empêcher qu'une clé privée soit utilisée par erreur comme si
// elle était publique (ou inversement).
export abstract class StorageService {
  abstract savePublic(
    buffer: Buffer,
    subdir: string,
    filename: string,
  ): Promise<string>;

  abstract savePrivate(
    buffer: Buffer,
    subdir: string,
    filename: string,
  ): Promise<string>;

  abstract getPublicUrl(key: string): string;

  abstract streamPrivate(key: string): Promise<Readable>;

  abstract delete(key: string): Promise<void>;
}
