// Traduction du format d'erreur homogène de l'API (voir CLAUDE.md §4) :
// `{ statusCode, message, error }`, où `message` est une chaîne (erreur
// métier — 403/404/409...) OU un tableau de messages (échec du
// ValidationPipe global — un message par contrainte violée, potentiellement
// plusieurs par champ).
import type { AxiosError } from 'axios';

export interface ApiErrorPayload {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface ApiError {
  statusCode: number;
  /** Toujours un tableau, même quand l'API a renvoyé une seule chaîne. */
  messages: string[];
  /** true si l'API a renvoyé un tableau — typiquement une erreur de validation. */
  isValidationError: boolean;
}

function isApiErrorPayload(data: unknown): data is ApiErrorPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    'statusCode' in data &&
    'message' in data
  );
}

/** Normalise une erreur axios en `ApiError`, ou `null` si la réponse ne suit
 * pas le format `{statusCode, message, error}` (erreur réseau, 5xx sans
 * corps JSON, etc. — voir `general` dans `mapMessagesToFields` pour ce cas). */
export function extractApiError(error: AxiosError): ApiError | null {
  const data = error.response?.data;
  if (!isApiErrorPayload(data)) return null;
  const messages = Array.isArray(data.message) ? data.message : [data.message];
  return {
    statusCode: data.statusCode,
    messages,
    isValidationError: Array.isArray(data.message),
  };
}

/**
 * Répartit les messages de validation entre les champs connus d'un
 * formulaire et un reliquat "général" (à afficher en notification).
 *
 * Heuristique nécessaire car l'API ne renvoie pas d'erreurs structurées par
 * champ, seulement un tableau de chaînes (voir CLAUDE.md §4) : un message
 * est attribué à `fieldName` s'il le contient comme mot entier (insensible
 * à la casse). Les messages par défaut de class-validator commencent
 * presque toujours par le nom de la propriété ("email must be an email") ;
 * un message personnalisé qui ne le mentionne pas atterrit dans le
 * reliquat général — le moins mauvais comportement possible sans changer
 * le contrat API.
 */
export function mapMessagesToFields(
  messages: string[],
  knownFields: readonly string[],
): { fieldErrors: Record<string, string[]>; general: string[] } {
  const fieldErrors: Record<string, string[]> = {};
  const general: string[] = [];

  for (const message of messages) {
    const match = knownFields.find((field) =>
      new RegExp(`\\b${field}\\b`, 'i').test(message),
    );
    if (match) {
      (fieldErrors[match] ??= []).push(message);
    } else {
      general.push(message);
    }
  }

  return { fieldErrors, general };
}
