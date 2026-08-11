import { createReadStream, promises as fs } from 'fs';
import { join, sep } from 'path';
import { Readable } from 'stream';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { resolveStorageRoot } from './resolve-storage-root';

const PUBLIC_SPACE = 'public';
const PRIVATE_SPACE = 'private';

@Injectable()
export class LocalDiskStorageService implements StorageService {
  private readonly root: string;
  private readonly appUrl: string;

  constructor(config: ConfigService) {
    this.root = resolveStorageRoot(config);
    this.appUrl = config.getOrThrow<string>('APP_URL');
  }

  async savePublic(
    buffer: Buffer,
    subdir: string,
    filename: string,
  ): Promise<string> {
    return this.write(PUBLIC_SPACE, subdir, filename, buffer);
  }

  async savePrivate(
    buffer: Buffer,
    subdir: string,
    filename: string,
  ): Promise<string> {
    return this.write(PRIVATE_SPACE, subdir, filename, buffer);
  }

  getPublicUrl(key: string): string {
    if (!key.startsWith(`${PUBLIC_SPACE}/`)) {
      throw new Error(
        `getPublicUrl() attend une clé de l'espace "${PUBLIC_SPACE}/", reçu : "${key}"`,
      );
    }
    const relativePath = key.slice(PUBLIC_SPACE.length + 1);
    return `${this.appUrl}/uploads/${relativePath}`;
  }

  async streamPrivate(key: string): Promise<Readable> {
    if (!key.startsWith(`${PRIVATE_SPACE}/`)) {
      throw new Error(
        `streamPrivate() attend une clé de l'espace "${PRIVATE_SPACE}/", reçu : "${key}"`,
      );
    }
    const absolutePath = this.resolveWithinRoot(key);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException('Fichier introuvable');
    }
    return createReadStream(absolutePath);
  }

  async delete(key: string): Promise<void> {
    const absolutePath = this.resolveWithinRoot(key);
    await fs.rm(absolutePath, { force: true });
  }

  private async write(
    space: string,
    subdir: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const key = `${space}/${subdir}/${filename}`;
    const absolutePath = this.resolveWithinRoot(key);
    await fs.mkdir(join(absolutePath, '..'), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
    return key;
  }

  // Défense en profondeur contre le path traversal : même si les noms de
  // fichiers sont générés côté serveur (jamais par le client), on vérifie
  // que le chemin résolu reste bien à l'intérieur de la racine de stockage.
  private resolveWithinRoot(key: string): string {
    const absolutePath = join(this.root, key);
    if (!absolutePath.startsWith(this.root + sep)) {
      throw new Error(`Clé de stockage invalide : "${key}"`);
    }
    return absolutePath;
  }
}
