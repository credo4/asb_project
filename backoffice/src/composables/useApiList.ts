// Composable réutilisé par TOUTES les listes paginées du back-office (voir
// prompt §1.6) : état de chargement, pagination, tri, filtres — synchronisés
// avec l'URL (`router.replace`, jamais `push` : changer un filtre ne doit
// pas empiler l'historique de navigation) pour qu'une liste filtrée reste
// partageable par lien. Le composable ignore tout de la forme de `T` ou de
// l'endpoint réel : on lui passe juste un `fetcher` qui respecte le contrat
// `{ data, meta: { total, page, perPage } }` (voir CLAUDE.md §4).
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LocationQueryRaw } from 'vue-router';

export interface ApiListMeta {
  total: number;
  page: number;
  perPage: number;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: ApiListMeta;
}

export type SortOrder = 'asc' | 'desc';

type FilterValues = Record<string, string | undefined>;

export interface UseApiListOptions<T, F extends FilterValues> {
  fetcher: (
    params: {
      page: number;
      perPage: number;
      sortBy?: string;
      sortOrder?: SortOrder;
    } & F,
  ) => Promise<ApiListResponse<T>>;
  /** Valeurs par défaut des filtres — définissent aussi les clés reconnues dans l'URL. */
  defaultFilters: F;
  defaultPerPage?: number;
  defaultSortBy?: string;
  defaultSortOrder?: SortOrder;
}

function readQueryString(
  query: Record<string, unknown>,
  key: string,
  fallback: string | undefined,
): string | undefined {
  const raw = query[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readQueryNumber(
  query: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const raw = readQueryString(query, key, undefined);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function useApiList<T, F extends FilterValues>(
  options: UseApiListOptions<T, F>,
) {
  const route = useRoute();
  const router = useRouter();

  const page = ref(readQueryNumber(route.query, 'page', 1));
  const perPage = ref(
    readQueryNumber(route.query, 'perPage', options.defaultPerPage ?? 25),
  );
  const sortBy = ref(
    readQueryString(route.query, 'sortBy', options.defaultSortBy),
  );
  const sortOrder = ref(
    readQueryString(
      route.query,
      'sortOrder',
      options.defaultSortOrder,
    ) as SortOrder | undefined,
  );

  const filterKeys = Object.keys(options.defaultFilters) as (keyof F &
    string)[];
  const filters = reactive({ ...options.defaultFilters }) as F;
  for (const key of filterKeys) {
    (filters as FilterValues)[key] = readQueryString(
      route.query,
      key,
      options.defaultFilters[key],
    );
  }

  const loading = ref(false);
  const error = ref<unknown>(null);
  const items = shallowRef<T[]>([]);
  const meta = ref<ApiListMeta>({
    total: 0,
    page: page.value,
    perPage: perPage.value,
  });

  /** Nombre de filtres actifs (différents de leur valeur par défaut) — pour
   * les puces "N filtres" et pour distinguer un vide "aucun résultat" d'un
   * vide "première utilisation" (voir prompt §1.2 / états système). */
  const activeFilterCount = computed(
    () =>
      filterKeys.filter(
        (key) =>
          filters[key] !== undefined &&
          filters[key] !== '' &&
          filters[key] !== options.defaultFilters[key],
      ).length,
  );

  const isEmpty = computed(
    () => !loading.value && !error.value && items.value.length === 0,
  );
  const isEmptyBecauseFiltered = computed(
    () => isEmpty.value && activeFilterCount.value > 0,
  );

  function syncUrl(): void {
    // Fusionne avec `route.query` plutôt que de repartir de zéro : une page
    // qui héberge CE composable à côté d'un autre état d'URL qui lui est
    // propre (ex: l'onglet actif et la période partagée de /reports, voir
    // ReportsView.vue) ne doit pas voir ces clés effacées à chaque
    // changement de page/tri/filtre. Sans danger pour les usages existants
    // (une liste seule sur sa route n'a jamais d'autre clé à préserver).
    const query: LocationQueryRaw = { ...route.query };
    if (page.value !== 1) query.page = String(page.value);
    else delete query.page;
    if (perPage.value !== (options.defaultPerPage ?? 25)) {
      query.perPage = String(perPage.value);
    } else {
      delete query.perPage;
    }
    if (sortBy.value) query.sortBy = sortBy.value;
    else delete query.sortBy;
    if (sortOrder.value) query.sortOrder = sortOrder.value;
    else delete query.sortOrder;
    for (const key of filterKeys) {
      const value = filters[key];
      if (value !== undefined && value !== '' && value !== options.defaultFilters[key]) {
        query[key] = value;
      } else {
        delete query[key];
      }
    }
    void router.replace({ query });
  }

  async function fetch(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const response = await options.fetcher({
        page: page.value,
        perPage: perPage.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        ...filters,
      });
      items.value = response.data;
      meta.value = response.meta;
    } catch (err) {
      error.value = err;
      items.value = [];
    } finally {
      loading.value = false;
    }
  }

  function setPage(next: number): void {
    page.value = next;
  }

  function setSort(field: string): void {
    if (sortBy.value === field) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy.value = field;
      sortOrder.value = 'asc';
    }
    page.value = 1;
  }

  function setFilter<K extends keyof F & string>(key: K, value: F[K]): void {
    filters[key] = value;
    page.value = 1; // changer un filtre revient toujours à la première page
  }

  function resetFilters(): void {
    for (const key of filterKeys) {
      filters[key] = options.defaultFilters[key];
    }
    page.value = 1;
  }

  watch(
    [page, perPage, sortBy, sortOrder, filters],
    () => {
      syncUrl();
      void fetch();
    },
    { deep: true },
  );

  syncUrl();
  void fetch();

  return {
    items,
    meta,
    loading,
    error,
    page,
    perPage,
    sortBy,
    sortOrder,
    filters,
    activeFilterCount,
    isEmpty,
    isEmptyBecauseFiltered,
    setPage,
    setSort,
    setFilter,
    resetFilters,
    refresh: fetch,
  };
}
