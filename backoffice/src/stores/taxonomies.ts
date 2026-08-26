// Référentiels (piliers/thèmes/formats/langues/pays/admins) utilisés par le
// formulaire speaker ET les filtres de liste — chargés une fois, mis en
// cache pour la session (ils ne changent quasiment jamais en cours
// d'utilisation ; un rechargement de page les rafraîchit).
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http } from '../lib/http';
import type { ApiResponse } from '../types/api-helpers';

type Pillar = ApiResponse<'/admin/taxonomies/pillars', 'get'>[number];
type Theme = ApiResponse<'/admin/taxonomies/themes', 'get'>[number];
type Format = ApiResponse<'/admin/taxonomies/formats', 'get'>[number];
type Language = ApiResponse<'/admin/taxonomies/languages', 'get'>[number];
type Country = ApiResponse<'/admin/taxonomies/countries', 'get'>[number];
type Admin = ApiResponse<'/admin/taxonomies/admins', 'get'>[number];

export const useTaxonomiesStore = defineStore('taxonomies', () => {
  const pillars = ref<Pillar[]>([]);
  const themes = ref<Theme[]>([]);
  const formats = ref<Format[]>([]);
  const languages = ref<Language[]>([]);
  const countries = ref<Country[]>([]);
  const admins = ref<Admin[]>([]);
  const loaded = ref(false);
  let loadPromise: Promise<void> | null = null;

  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return;
    loadPromise ??= (async () => {
      const [
        pillarsRes,
        themesRes,
        formatsRes,
        languagesRes,
        countriesRes,
        adminsRes,
      ] = await Promise.all([
        http.get<Pillar[]>('/admin/taxonomies/pillars'),
        http.get<Theme[]>('/admin/taxonomies/themes'),
        http.get<Format[]>('/admin/taxonomies/formats'),
        http.get<Language[]>('/admin/taxonomies/languages'),
        http.get<Country[]>('/admin/taxonomies/countries'),
        http.get<Admin[]>('/admin/taxonomies/admins'),
      ]);
      pillars.value = pillarsRes.data;
      themes.value = themesRes.data;
      formats.value = formatsRes.data;
      languages.value = languagesRes.data;
      countries.value = countriesRes.data;
      admins.value = adminsRes.data;
      loaded.value = true;
    })();
    await loadPromise;
  }

  function themesForPillar(pillarId: number | null | undefined): Theme[] {
    if (!pillarId) return [];
    return themes.value.filter((t) => t.pillarId === pillarId);
  }

  function adminName(admin: Admin): string {
    const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
    return name || admin.email;
  }

  return {
    pillars,
    themes,
    formats,
    languages,
    countries,
    admins,
    loaded,
    ensureLoaded,
    themesForPillar,
    adminName,
  };
});
