// Client API central. Deux instances axios :
// - `rawHttp` : sans intercepteur, utilisée pour /auth/login et /auth/refresh
//   eux-mêmes (pour ne jamais boucler dessus depuis l'intercepteur ci-dessous).
// - `http` : l'instance utilisée par tout le reste de l'app — pose le
//   token d'accès, gère le 401 (rafraîchissement, une seule fois, requêtes
//   concurrentes mises en attente du même rafraîchissement), et traduit le
//   format d'erreur homogène de l'API en notification (voir lib/api-error.ts).
import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import ToastEventBus from 'primevue/toasteventbus';
import router from '../router';
import { useAuthStore } from '../stores/auth';
import { extractApiError } from './api-error';

const baseURL = import.meta.env.VITE_API_URL as string;

export const rawHttp = axios.create({ baseURL });
export const http = axios.create({ baseURL });

http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.accessToken) {
    config.headers.set('Authorization', `Bearer ${auth.accessToken}`);
  }
  return config;
});

// Marque la requête déjà rejouée une fois, pour ne jamais entrer dans une
// boucle infinie si le token rafraîchi est, lui aussi, rejeté.
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Plusieurs requêtes peuvent échouer en 401 en même temps (ex: un
// dashboard qui lance 4 appels en parallèle juste après l'expiration du
// token) : sans ce verrou, chacune déclencherait son propre appel
// /auth/refresh (le back-end invaliderait le refresh token précédent à
// chaque rotation — voir CLAUDE.md §8 — et seule la première réussirait).
// Toutes les requêtes concurrentes attendent la MÊME promesse.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const auth = useAuthStore();
  if (!auth.refreshToken) {
    throw new Error('Aucun refresh token disponible.');
  }
  const { data } = await rawHttp.post<{
    accessToken: string;
    refreshToken: string;
  }>('/auth/refresh', { refreshToken: auth.refreshToken });
  auth.setTokens(data);
  return data.accessToken;
}

function notifyGeneralError(messages: string[]): void {
  if (messages.length === 0) return;
  ToastEventBus.emit('add', {
    severity: 'error',
    summary: 'Erreur',
    detail: messages.join(' '),
    life: 6000,
  });
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const auth = useAuthStore();

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      auth.refreshToken
    ) {
      original._retried = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const token = await refreshPromise;
        original.headers = AxiosHeaders.from(original.headers);
        original.headers.set('Authorization', `Bearer ${token}`);
        return await http(original);
      } catch {
        auth.clearTokens();
        await router.push({
          name: 'login',
          query: { redirect: router.currentRoute.value.fullPath },
        });
        return Promise.reject(error);
      }
    }

    const apiError = extractApiError(error);
    // Les erreurs de validation (tableau de messages) ne sont volontairement
    // PAS notifiées ici : c'est au formulaire appelant de les répartir par
    // champ (voir lib/api-error.ts#mapMessagesToFields) et de notifier lui-
    // même le reliquat général. Seules les erreurs "métier" à message
    // unique (403, 404, 409, 500...) sont notifiées automatiquement ici,
    // pour ne pas obliger chaque appelant à dupliquer ce cas.
    if (apiError && !apiError.isValidationError) {
      notifyGeneralError(apiError.messages);
    } else if (!apiError) {
      notifyGeneralError(['Impossible de contacter le serveur.']);
    }

    return Promise.reject(apiError ?? error);
  },
);
