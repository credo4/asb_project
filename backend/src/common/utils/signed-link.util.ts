import { createHmac, timingSafeEqual } from 'crypto';

// Lien signé plutôt qu'un simple UUID "secret" dans l'URL : un UUID est un
// SECRET PARTAGÉ opaque — pour l'invalider ou le faire expirer, il faut une
// ligne en base qui le mémorise, vérifiée à chaque accès (une table de
// tokens à gérer, purger, indexer). Un lien HMAC n'a besoin d'AUCUN état
// côté serveur : la preuve d'authenticité est mathématique (impossible à
// forger sans connaître FILE_SIGNING_SECRET) et l'expiration est encodée
// DANS le lien lui-même — la vérification se résume à recalculer la
// signature et comparer une date, sans jamais consulter de table de
// révocation. Effet pratique : si le lien fuite (historique navigateur,
// logs, redirection), il n'est exploitable QUE pendant sa fenêtre de
// validité (5 minutes par défaut), pas indéfiniment comme un UUID qu'on
// aurait oublié de désactiver.
//
// GÉNÉRIQUE (extrait de speaker-documents/ en Phase 3b) : `resourceId` ne
// présume pas de quelle table il s'agit — chaque appelant (SpeakerDocument,
// BookingRequestAttachment, ...) sait déjà, via son propre endpoint de
// génération de lien, quelle table interroger avec cet id. Réutilisé tel
// quel par speaker-documents ET booking-requests (pièces jointes) : la
// cryptographie ne se réimplémente jamais deux fois.

export interface SignedResourcePayload {
  resourceId: number;
  issuedForUserId: number;
  expiresAt: number; // epoch ms
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

// `storageKey` participe au message signé (mais ne quitte jamais le
// serveur : jamais inclus dans le payload renvoyé au client) : lie
// cryptographiquement la signature au fichier physique exact, pas seulement
// à son identifiant en base.
function computeSignature(
  secret: string,
  payloadB64: string,
  storageKey: string,
): string {
  return createHmac('sha256', secret)
    .update(`${payloadB64}.${storageKey}`)
    .digest('base64url');
}

export function createSignedResourceToken(
  secret: string,
  payload: SignedResourcePayload,
  storageKey: string,
): string {
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = computeSignature(secret, payloadB64, storageKey);
  return `${payloadB64}.${signature}`;
}

export type TokenDecodeResult =
  | {
      ok: true;
      payload: SignedResourcePayload;
      payloadB64: string;
      signature: string;
    }
  | { ok: false };

// Ne fait QUE parser la structure — ne prouve encore rien. Le resourceId
// extrait ici sert à aller chercher le storageKey correspondant en base,
// nécessaire pour recalculer la signature attendue. Un resourceId falsifié
// sans falsifier aussi la signature (impossible sans le secret) sera rejeté
// à l'étape suivante.
export function decodeSignedResourceToken(token: string): TokenDecodeResult {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false };
  }
  const [payloadB64, signature] = parts;
  try {
    const payload = JSON.parse(
      base64UrlDecode(payloadB64),
    ) as SignedResourcePayload;
    if (
      typeof payload.resourceId !== 'number' ||
      typeof payload.issuedForUserId !== 'number' ||
      typeof payload.expiresAt !== 'number'
    ) {
      return { ok: false };
    }
    return { ok: true, payload, payloadB64, signature };
  } catch {
    return { ok: false };
  }
}

export function isResourceSignatureValid(
  secret: string,
  payloadB64: string,
  storageKey: string,
  providedSignature: string,
): boolean {
  const expected = computeSignature(secret, payloadB64, storageKey);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(providedSignature);
  // Longueurs différentes = signature forcément invalide ; timingSafeEqual
  // lève une exception sur des buffers de tailles différentes plutôt que de
  // renvoyer false, d'où ce garde préalable.
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}
