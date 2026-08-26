// Sélecteur de période PARTAGÉ entre les 3 onglets de /reports (voir
// ReportsView.vue) : un seul état, possédé ici, synchronisé avec l'URL
// (`router.replace`, jamais `push` -- même convention que useApiList) pour
// qu'un lien vers un rapport sur une période donnée reste partageable.
//
// Raccourcis en fenêtre GLISSANTE (pas calée sur le calendrier) : "30
// derniers jours" veut dire exactement ça, pas "depuis le 1er du mois" --
// cohérent avec la période par défaut de l'API (resolvePeriods, backend)
// qui est elle aussi une fenêtre de 30 jours se terminant maintenant.
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export const PERIOD_PRESETS = ['last30', 'quarter', 'year', 'custom'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  last30: '30 derniers jours',
  quarter: 'Trimestre',
  year: 'Année',
  custom: 'Personnalisé',
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Exclude<PeriodPreset, 'custom'>): {
  from: string;
  to: string;
} {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'last30') from.setDate(from.getDate() - 30);
  else if (preset === 'quarter') from.setMonth(from.getMonth() - 3);
  else if (preset === 'year') from.setFullYear(from.getFullYear() - 1);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function readString(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const raw = query[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function useReportPeriod() {
  const route = useRoute();
  const router = useRouter();

  const initialPreset = readString(route.query, 'preset');
  const preset = ref<PeriodPreset>(
    (PERIOD_PRESETS as readonly string[]).includes(initialPreset ?? '')
      ? (initialPreset as PeriodPreset)
      : 'last30',
  );

  const fallback = presetRange('last30');
  const customFrom = ref<string>(
    readString(route.query, 'from') ?? fallback.from,
  );
  const customTo = ref<string>(readString(route.query, 'to') ?? fallback.to);

  // Bornes effectives : calculées à chaque lecture pour un raccourci (une
  // fenêtre glissante ne doit pas se figer à l'ouverture de la page), figées
  // aux valeurs choisies par l'utilisateur en mode "personnalisé".
  const range = computed<{ from: string; to: string }>(() =>
    preset.value === 'custom'
      ? { from: customFrom.value, to: customTo.value }
      : presetRange(preset.value),
  );

  function setPreset(next: PeriodPreset): void {
    preset.value = next;
  }

  function setCustomRange(from: string, to: string): void {
    customFrom.value = from;
    customTo.value = to;
    preset.value = 'custom';
  }

  watch(
    [preset, customFrom, customTo],
    () => {
      const query: Record<string, string> = { ...route.query, preset: preset.value } as Record<
        string,
        string
      >;
      if (preset.value === 'custom') {
        query.from = customFrom.value;
        query.to = customTo.value;
      } else {
        delete query.from;
        delete query.to;
      }
      void router.replace({ query });
    },
    { immediate: true },
  );

  return { preset, range, setPreset, setCustomRange };
}
