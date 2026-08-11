import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImageVariant {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ProcessedImage {
  display: ProcessedImageVariant;
  thumbnail: ProcessedImageVariant;
}

const DISPLAY_MAX_SIDE = 1600;
const THUMBNAIL_MAX_SIDE = 400;
const WEBP_QUALITY = 85;

@Injectable()
export class ImageProcessingService {
  async process(buffer: Buffer): Promise<ProcessedImage> {
    await this.assertIsRealImage(buffer);

    const [display, thumbnail] = await Promise.all([
      this.resize(buffer, DISPLAY_MAX_SIDE),
      this.resize(buffer, THUMBNAIL_MAX_SIDE),
    ]);

    return { display, thumbnail };
  }

  // On ne fait JAMAIS confiance à l'extension du fichier ou au Content-Type
  // envoyé par le client (facilement falsifiables) : sharp doit réussir à
  // décoder le buffer comme une vraie image, sinon on rejette.
  private async assertIsRealImage(buffer: Buffer): Promise<void> {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Dimensions manquantes');
      }
    } catch {
      throw new UnsupportedMediaTypeException(
        "Le fichier envoyé n'est pas une image valide.",
      );
    }
  }

  private async resize(
    buffer: Buffer,
    maxSide: number,
  ): Promise<ProcessedImageVariant> {
    const { data, info } = await sharp(buffer)
      // `.rotate()` sans argument applique l'orientation EXIF (photo prise
      // en portrait sur un téléphone, etc.) AVANT qu'on ne jette les
      // métadonnées — sinon l'image ressortirait de travers.
      .rotate()
      .resize({
        width: maxSide,
        height: maxSide,
        fit: 'inside',
        // Ne jamais agrandir une image plus petite que la cible.
        withoutEnlargement: true,
      })
      // Ne PAS appeler `.withMetadata()` : c'est ce qui garantit que l'EXIF
      // (position GPS, modèle d'appareil, etc.) n'est jamais copié dans le
      // dérivé généré.
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      sizeBytes: info.size,
    };
  }
}
