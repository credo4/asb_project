<script setup lang="ts">
// §14.1 — rapport Speakers. 4 tuiles globales + table par speaker
// (useApiList, réutilisé tel quel) + 3 classements (formats/thèmes/pays
// clients, non paginés — voir CLAUDE.md pour la distinction table/tuile et
// le choix de ne PAS paginer les classements "top N").
import { computed, ref, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Paginator from 'primevue/paginator';
import Skeleton from 'primevue/skeleton';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Chart from 'primevue/chart';
import { useApiList } from '../../../composables/useApiList';
import {
  fetchSpeakersReport,
  downloadReportCsv,
  type SpeakersReport,
  type SpeakerMetric,
} from '../../../services/reports';
import {
  formatNumber,
  formatPercentValue,
  formatDeltaPercent,
  deltaSeverity,
  resolveToken,
} from '../../../lib/report-format';
import type { RankingItemDto } from '../../../lib/report-types';

const props = defineProps<{ from: string; to: string }>();

const report = ref<SpeakersReport | null>(null);
const reportLoading = ref(true);
const reportError = ref(false);

async function loadReport(): Promise<void> {
  reportLoading.value = true;
  reportError.value = false;
  try {
    report.value = await fetchSpeakersReport({ from: props.from, to: props.to });
  } catch {
    reportError.value = true;
  } finally {
    reportLoading.value = false;
  }
}

const list = useApiList<SpeakerMetric, Record<string, string | undefined>>({
  fetcher: async (params) => {
    const res = await fetchSpeakersReport({
      from: props.from,
      to: props.to,
      page: params.page,
      perPage: params.perPage,
    });
    return { data: res.speakers, meta: res.speakersMeta };
  },
  defaultFilters: {},
  defaultPerPage: 20,
});

watch(
  () => [props.from, props.to],
  () => {
    void loadReport();
    list.page.value = 1;
    void list.refresh();
  },
  { immediate: true },
);

const tiles = computed(() => {
  if (!report.value) return [];
  const r = report.value;
  return [
    {
      key: 'views',
      label: 'Vues de profil (dédoublonnées)',
      value: formatNumber(r.totalProfileViews.current),
      compared: r.totalProfileViews,
      goodDirection: 'up' as const,
    },
    {
      key: 'requests',
      label: 'Demandes ayant cité un speaker',
      value: formatNumber(r.totalRequests.current),
      compared: r.totalRequests,
      goodDirection: 'up' as const,
    },
    {
      key: 'missions',
      label: 'Missions',
      value: formatNumber(r.totalMissions.current),
      compared: r.totalMissions,
      goodDirection: 'up' as const,
    },
    {
      key: 'acceptance',
      label: 'Taux d’acceptation des sollicitations',
      value: formatPercentValue(r.acceptanceRate.current),
      compared: r.acceptanceRate,
      goodDirection: 'up' as const,
    },
  ];
});

// §Partie B — "pas assez de données" : un graphique avec 0 ou 1 barre ne
// dit rien et ressemble à un produit cassé. Seuil volontairement bas (2) —
// il ne s'agit pas de significativité statistique, juste d'éviter une
// courbe/un histogramme vide ou à une seule colonne.
const MIN_CHART_ITEMS = 2;
const hasEnoughFormatsData = computed(
  () => (report.value?.topFormats.length ?? 0) >= MIN_CHART_ITEMS,
);

function buildBarChart(items: RankingItemDto[]) {
  return {
    labels: items.map((i) => i.label),
    datasets: [
      {
        label: 'Speakers proposés',
        data: items.map((i) => i.count),
        backgroundColor: resolveToken('--asb-gold-500'),
        borderRadius: 2,
      },
    ],
  };
}
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
};

const exporting = ref<string | null>(null);
async function exportCsv(table?: string): Promise<void> {
  exporting.value = table ?? 'speakers';
  try {
    await downloadReportCsv('speakers', { from: props.from, to: props.to }, table);
  } finally {
    exporting.value = null;
  }
}
</script>

<template>
  <div class="speakers-panel">
    <div v-if="reportLoading && !report" class="tiles-grid">
      <Skeleton v-for="n in 4" :key="n" height="6.5rem" />
    </div>
    <Message v-else-if="reportError" severity="error" :closable="false">
      Impossible de charger les indicateurs. <a href="#" @click.prevent="loadReport">Réessayer</a>.
    </Message>
    <div v-else-if="report" class="tiles-grid">
      <div v-for="tile in tiles" :key="tile.key" class="kpi-tile">
        <span class="kpi-tile__label">{{ tile.label }}</span>
        <span class="kpi-tile__value">{{ tile.value }}</span>
        <span
          class="kpi-tile__delta"
          :class="`kpi-tile__delta--${deltaSeverity(tile.compared, tile.goodDirection)}`"
        >
          {{ formatDeltaPercent(tile.compared.deltaPercent) }}
        </span>
      </div>
    </div>

    <section class="chart-section">
      <div class="chart-section__header">
        <h2>Formats les plus demandés</h2>
        <Button
          label="CSV"
          icon="pi pi-download"
          size="small"
          severity="secondary"
          outlined
          :loading="exporting === 'topFormats'"
          @click="exportCsv('topFormats')"
        />
      </div>
      <div v-if="reportLoading && !report" class="chart-placeholder">
        <Skeleton height="260px" />
      </div>
      <Chart
        v-else-if="hasEnoughFormatsData"
        type="bar"
        :data="buildBarChart(report!.topFormats)"
        :options="chartOptions"
        style="height: 260px"
      />
      <div v-else class="not-enough-data">
        <span class="not-enough-data__icon"><i class="pi pi-chart-bar" /></span>
        <p class="not-enough-data__title">Pas encore assez de données sur cette période</p>
        <p class="not-enough-data__text">
          Élargissez la période (trimestre ou année) pour voir apparaître un graphique lisible.
        </p>
      </div>
    </section>

    <section class="table-section">
      <div class="table-section__header">
        <h2>Par speaker</h2>
        <Button
          label="CSV"
          icon="pi pi-download"
          size="small"
          severity="secondary"
          outlined
          :loading="exporting === 'speakers'"
          @click="exportCsv('speakers')"
        />
      </div>

      <div v-if="list.error.value" class="state-block state-block--error">
        <Message severity="error" variant="simple" size="small">
          Impossible de charger le tableau.
        </Message>
        <Button label="Réessayer" size="small" @click="list.refresh()" />
      </div>
      <div v-else-if="list.loading.value" class="state-block">
        <Skeleton height="12rem" />
      </div>
      <div v-else-if="list.isEmpty.value" class="state-block">
        <span class="state-block__icon">⌕</span>
        <div class="state-block__title">Aucune activité speaker sur cette période</div>
      </div>
      <template v-else>
        <DataTable :value="list.items.value" data-key="speakerId">
          <Column field="displayName" header="Speaker" style="min-width: 180px" />
          <Column header="Vues" style="min-width: 90px">
            <template #body="{ data }: { data: SpeakerMetric }">{{ formatNumber(data.profileViews) }}</template>
          </Column>
          <Column header="Demandes" style="min-width: 100px">
            <template #body="{ data }: { data: SpeakerMetric }">{{ formatNumber(data.requestsCount) }}</template>
          </Column>
          <Column header="Missions" style="min-width: 100px">
            <template #body="{ data }: { data: SpeakerMetric }">{{ formatNumber(data.missionsCount) }}</template>
          </Column>
          <Column header="Taux d'acceptation" style="min-width: 140px">
            <template #body="{ data }: { data: SpeakerMetric }">
              {{ data.availabilityAcceptanceRate === null ? '—' : formatPercentValue(data.availabilityAcceptanceRate) }}
              <span v-if="data.availabilityResponsesTotal > 0" class="table-note">
                ({{ data.availabilityResponsesTotal }} réponse{{ data.availabilityResponsesTotal > 1 ? 's' : '' }})
              </span>
            </template>
          </Column>
          <!-- SUPER_ADMIN uniquement : clé absente du JSON pour un ADMIN, colonne
               masquée -- pas grisée -- via ce v-if (voir CLAUDE.md §A4). -->
          <Column v-if="list.items.value[0]?.realizedRevenue !== undefined" header="Revenus réalisés" style="min-width: 130px">
            <template #body="{ data }: { data: SpeakerMetric }">
              {{ data.realizedRevenue !== undefined ? formatNumber(data.realizedRevenue) : '—' }}
            </template>
          </Column>
        </DataTable>

        <Paginator
          :rows="list.meta.value.perPage"
          :total-records="list.meta.value.total"
          :first="(list.page.value - 1) * list.meta.value.perPage"
          :rows-per-page-options="[20, 50, 100]"
          @page="(e) => { list.setPage(e.page + 1); list.perPage.value = e.rows; }"
        />
      </template>
    </section>

    <section v-if="report" class="rankings-grid">
      <div class="ranking-card">
        <div class="ranking-card__header">
          <h3>Thématiques les plus demandées</h3>
          <Button icon="pi pi-download" text size="small" :loading="exporting === 'topThemes'" @click="exportCsv('topThemes')" />
        </div>
        <p v-if="report.topThemes.length === 0" class="ranking-card__empty">Pas assez de données sur cette période.</p>
        <ul v-else class="ranking-list">
          <li v-for="item in report.topThemes" :key="item.id">
            <span>{{ item.label }}</span><span class="ranking-list__count">{{ item.count }}</span>
          </li>
        </ul>
      </div>
      <div class="ranking-card">
        <div class="ranking-card__header">
          <h3>Pays des clients</h3>
          <Button icon="pi pi-download" text size="small" :loading="exporting === 'topClientCountries'" @click="exportCsv('topClientCountries')" />
        </div>
        <p v-if="report.topClientCountries.length === 0" class="ranking-card__empty">Pas assez de données sur cette période.</p>
        <ul v-else class="ranking-list">
          <li v-for="item in report.topClientCountries" :key="item.id">
            <span>{{ item.label }}</span><span class="ranking-list__count">{{ item.count }}</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tiles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--asb-space-4);
  margin-bottom: var(--asb-space-6);
}

.kpi-tile {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
  padding: var(--asb-space-4) var(--asb-space-6);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
}

.kpi-tile__label {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.kpi-tile__value {
  font-family: var(--asb-font-mono);
  font-size: var(--asb-text-display);
  font-weight: 600;
  color: var(--asb-text);
  line-height: 1.1;
}

.kpi-tile__delta {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.kpi-tile__delta--success { color: var(--asb-success-600); }
.kpi-tile__delta--danger { color: var(--asb-danger-600); }

.chart-section,
.table-section {
  margin-bottom: var(--asb-space-6);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-4);
}

.chart-section__header,
.table-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--asb-space-3);
}

.chart-section__header h2,
.table-section__header h2 {
  margin: 0;
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.not-enough-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-8);
  color: var(--asb-text-muted);
}

.not-enough-data__icon {
  width: 44px;
  height: 44px;
  border: 1px solid var(--asb-border-strong);
  border-radius: var(--asb-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--asb-gold-500);
}

.not-enough-data__title {
  margin: 0;
  font-weight: 600;
  color: var(--asb-text);
}

.not-enough-data__text {
  margin: 0;
  font-size: var(--asb-text-sm);
  max-width: 40ch;
}

.table-note {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.rankings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--asb-space-4);
}

.ranking-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-4);
}

.ranking-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--asb-space-2);
}

.ranking-card__header h3 {
  margin: 0;
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}

.ranking-card__empty {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.ranking-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
}

.ranking-list li {
  display: flex;
  justify-content: space-between;
  font-size: var(--asb-text-sm);
  color: var(--asb-text);
  padding: var(--asb-space-1) 0;
  border-bottom: 1px solid var(--asb-border);
}

.ranking-list__count {
  font-family: var(--asb-font-mono);
  color: var(--asb-text-muted);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-8);
  text-align: center;
}

.state-block--error {
  color: var(--asb-danger-600);
}

.state-block__icon {
  width: 44px;
  height: 44px;
  border: 1px solid var(--asb-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--asb-text-muted);
  font-size: 18px;
}

.state-block__title {
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}
</style>
