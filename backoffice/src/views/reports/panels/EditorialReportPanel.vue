<script setup lang="ts">
// §14.3 — rapport Éditorial. Recherches SANS RÉSULTAT mises en avant (le
// plus actionnable, voir CLAUDE.md §14.3) : ce que les clients cherchent et
// que le roster n'a pas.
import { computed, ref, watch } from 'vue';
import Chart from 'primevue/chart';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import {
  fetchEditorialReport,
  downloadReportCsv,
  type EditorialReport,
} from '../../../services/reports';
import {
  formatNumber,
  formatDeltaPercent,
  deltaSeverity,
  resolveToken,
} from '../../../lib/report-format';

const props = defineProps<{ from: string; to: string }>();

const report = ref<EditorialReport | null>(null);
const loading = ref(true);
const error = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = false;
  try {
    report.value = await fetchEditorialReport({ from: props.from, to: props.to });
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}
watch(() => [props.from, props.to], load, { immediate: true });

const tiles = computed(() => {
  if (!report.value) return [];
  const r = report.value;
  return [
    {
      key: 'searches',
      label: 'Recherches effectuées',
      value: formatNumber(r.searchesCount.current),
      compared: r.searchesCount,
      goodDirection: 'up' as const,
    },
    {
      key: 'zero',
      label: 'Recherches sans résultat',
      value: formatNumber(r.zeroResultSearchesCount.current),
      compared: r.zeroResultSearchesCount,
      goodDirection: 'down' as const,
    },
    {
      key: 'clicks',
      label: '"Check Availability" cliqués',
      value: formatNumber(r.checkAvailabilityClicks.current),
      compared: r.checkAvailabilityClicks,
      goodDirection: 'up' as const,
    },
  ];
});

const MIN_CHART_ITEMS = 2;
const hasEnoughFiltersData = computed(
  () => (report.value?.topFilters.length ?? 0) >= MIN_CHART_ITEMS,
);
const chartData = computed(() => {
  const items = report.value?.topFilters ?? [];
  return {
    labels: items.map((i) => i.label),
    datasets: [
      {
        label: 'Filtres utilisés',
        data: items.map((i) => i.count),
        backgroundColor: resolveToken('--asb-info-600'),
        borderRadius: 2,
      },
    ],
  };
});
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: { legend: { display: false } },
  scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
};

const exporting = ref<string | null>(null);
async function exportCsv(table?: string): Promise<void> {
  exporting.value = table ?? 'topViewedProfiles';
  try {
    await downloadReportCsv('editorial', { from: props.from, to: props.to }, table);
  } finally {
    exporting.value = null;
  }
}
</script>

<template>
  <div class="editorial-panel">
    <div v-if="loading && !report" class="tiles-grid">
      <Skeleton v-for="n in 3" :key="n" height="6.5rem" />
    </div>
    <Message v-else-if="error" severity="error" :closable="false">
      Impossible de charger les indicateurs. <a href="#" @click.prevent="load">Réessayer</a>.
    </Message>
    <template v-else-if="report">
      <div class="tiles-grid">
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
          <h2>Filtres les plus utilisés</h2>
          <Button
            label="CSV"
            icon="pi pi-download"
            size="small"
            severity="secondary"
            outlined
            :loading="exporting === 'topFilters'"
            @click="exportCsv('topFilters')"
          />
        </div>
        <Chart
          v-if="hasEnoughFiltersData"
          type="bar"
          :data="chartData"
          :options="chartOptions"
          style="height: 240px"
        />
        <div v-else class="not-enough-data">
          <span class="not-enough-data__icon"><i class="pi pi-chart-bar" /></span>
          <p class="not-enough-data__title">Pas encore assez de données sur cette période</p>
          <p class="not-enough-data__text">
            Élargissez la période pour voir apparaître un graphique lisible.
          </p>
        </div>
      </section>

      <section class="rankings-grid">
        <div class="ranking-card ranking-card--highlight">
          <div class="ranking-card__header">
            <h3>Recherches sans résultat</h3>
            <Button icon="pi pi-download" text size="small" :loading="exporting === 'topZeroResultQueries'" @click="exportCsv('topZeroResultQueries')" />
          </div>
          <p v-if="report.topZeroResultQueries.length === 0" class="ranking-card__empty">Pas assez de données sur cette période.</p>
          <ul v-else class="ranking-list">
            <li v-for="(item, i) in report.topZeroResultQueries" :key="i">
              <span>{{ item.query ?? '(filtres seuls, sans texte)' }}</span>
              <span class="ranking-list__count">{{ item.count }}</span>
            </li>
          </ul>
        </div>
        <div class="ranking-card">
          <div class="ranking-card__header">
            <h3>Profils les plus vus</h3>
            <Button icon="pi pi-download" text size="small" :loading="exporting === 'topViewedProfiles'" @click="exportCsv('topViewedProfiles')" />
          </div>
          <p v-if="report.topViewedProfiles.length === 0" class="ranking-card__empty">Pas assez de données sur cette période.</p>
          <ul v-else class="ranking-list">
            <li v-for="item in report.topViewedProfiles" :key="item.id">
              <span>{{ item.label }}</span><span class="ranking-list__count">{{ item.count }}</span>
            </li>
          </ul>
        </div>
        <div class="ranking-card">
          <div class="ranking-card__header">
            <h3>Listes éditoriales consultées</h3>
            <Button icon="pi pi-download" text size="small" :loading="exporting === 'curatedListViews'" @click="exportCsv('curatedListViews')" />
          </div>
          <p v-if="report.curatedListViews.length === 0" class="ranking-card__empty">Pas assez de données sur cette période.</p>
          <ul v-else class="ranking-list">
            <li v-for="item in report.curatedListViews" :key="item.id">
              <span>{{ item.label }}</span><span class="ranking-list__count">{{ item.count }}</span>
            </li>
          </ul>
        </div>
      </section>
    </template>
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

.chart-section {
  margin-bottom: var(--asb-space-6);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-4);
}

.chart-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--asb-space-3);
}

.chart-section__header h2 {
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

.ranking-card--highlight {
  border-left: 3px solid var(--asb-warning-600);
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
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
  color: var(--asb-text);
  padding: var(--asb-space-1) 0;
  border-bottom: 1px solid var(--asb-border);
}

.ranking-list__count {
  font-family: var(--asb-font-mono);
  color: var(--asb-text-muted);
  flex-shrink: 0;
}
</style>
