// Store Pinia d'authentification. Concept TS/Vue : la syntaxe "setup store"
// (une fonction qui retourne des refs/computed/fonctions, plutôt qu'un objet
// {state, getters, actions}) permet d'écrire un store Pinia avec la même
// syntaxe qu'un composant `<script setup>` — plus proche de ce qu'on écrit
// déjà ailleurs dans l'app.
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { http, rawHttp } from '../lib/http';
import type { ApiRequestBody, ApiResponse } from '../types/api-helpers';

type LoginBody = ApiRequestBody<'/auth/login', 'post'>;
type TokenPair = ApiResponse<'/auth/login', 'post'>;
type Me = ApiResponse<'/auth/me', 'get'>;

// L'API ne pose pas de cookie (elle renvoie les deux tokens dans le corps
// JSON, voir CLAUDE.md §8 — access + refresh, rotation des refresh tokens) :
// localStorage est donc la seule option côté client sans changer le contrat
// API. Compromis assumé (exposé aux attaques XSS, contrairement à un cookie
// httpOnly) — acceptable pour ce back-office interne, à revisiter si l'API
// gagne un jour un mode "cookie de session".
const ACCESS_TOKEN_KEY = 'asb_access_token';
const REFRESH_TOKEN_KEY = 'asb_refresh_token';

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(
    localStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const refreshToken = ref<string | null>(
    localStorage.getItem(REFRESH_TOKEN_KEY),
  );
  const user = ref<Me | null>(null);
  // Distingue "pas encore vérifié" de "vérifié, pas connecté" — le garde de
  // route (router/index.ts) attend cette étape avant de laisser passer ou
  // rediriger, pour ne jamais rediriger vers /login par erreur pendant un
  // rafraîchissement de page où le profil n'a pas encore été re-fetché.
  const isReady = ref(false);

  const isAuthenticated = computed(() => Boolean(accessToken.value));
  const fullName = computed(() => {
    if (!user.value) return null;
    const parts = [user.value.firstName, user.value.lastName].filter(
      (part): part is string => Boolean(part),
    );
    return parts.length > 0 ? parts.join(' ') : user.value.email;
  });

  function setTokens(pair: TokenPair): void {
    accessToken.value = pair.accessToken;
    refreshToken.value = pair.refreshToken;
    localStorage.setItem(ACCESS_TOKEN_KEY, pair.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, pair.refreshToken);
  }

  function clearTokens(): void {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  async function fetchMe(): Promise<void> {
    const { data } = await http.get<Me>('/auth/me');
    user.value = data;
  }

  async function login(body: LoginBody): Promise<void> {
    // `rawHttp`, pas `http` : évite tout risque de boucle avec
    // l'intercepteur 401/refresh de `http` (voir lib/http.ts) sur cette
    // toute première requête, où il n'y a par définition pas encore de
    // token à rafraîchir.
    const { data } = await rawHttp.post<TokenPair>('/auth/login', body);
    setTokens(data);
    await fetchMe();
  }

  function logout(): void {
    clearTokens();
  }

  // Appelé une fois au démarrage de l'app (voir main.ts) : si un token
  // survit d'une session précédente (localStorage), revalide-le en
  // récupérant le profil ; sinon la session est simplement absente.
  async function initialize(): Promise<void> {
    if (accessToken.value) {
      try {
        await fetchMe();
      } catch {
        // Token expiré/invalide et le refresh (intercepteur, lib/http.ts) a
        // déjà échoué à ce stade — repart sur un état déconnecté propre.
        clearTokens();
      }
    }
    isReady.value = true;
  }

  return {
    accessToken,
    refreshToken,
    user,
    isReady,
    isAuthenticated,
    fullName,
    setTokens,
    clearTokens,
    login,
    fetchMe,
    logout,
    initialize,
  };
});
