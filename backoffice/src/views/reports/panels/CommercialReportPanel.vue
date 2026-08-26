<script setup lang="ts">
// §14.2 — rapport Commercial. Série temporelle des demandes (Chart PrimeVue,
// ligne), tuiles (taux de conversion/délai de réponse/montant client moyen/
// demandes annulées), chiffre d'affaires + commission RÉALISÉ vs
// PRÉVISIONNEL (SUPER_ADMIN uniquement -- clés absentes du JSON pour un
// ADMIN, `v-if` suffit, aucune vérification de rôle côté client).
import { computed, ref, watch } from 'vue';
import Chart from 'primevue/chart';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import {
  fetchCommercialReport,
  downloadReportCsv,
  type CommercialReport,
} from '../../../services/reports';
import {
  formatNumber,
  formatPercentValue,
  formatDeltaPercent,
  formatCurrency,
  deltaSeverity,
  resolveToken,
} from '../../../lib/report-format';

const props = defineProps<{ from: string; to: string }>();

const report = ref<CommercialReport | null>(null);
const loading = ref(true);
const error = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = false;
  try {
    report.value = await fetchCommercialReport({ from: props.from, to: props.to });
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
      key: 'conversion',
      label: 'Taux de conversion demande → mission',
      hint: r.conversionRateDefinition,
      value: formatPercentValue(r.conversionRate.current),
      compared: r.conversionRate,
      goodDirection: 'up' as const,
    },
    {
      key: 'response',
      label: 'Délai moyen de première réponse',
      hint: null,
      value: `${r.averageFirstResponseHours.current.toFixed(1)} h`,
      compared: r.averageFirstResponseHours,
      goodDirection: 'down' as const,
    },
    {
      key: 'amount',
      label: 'Montant client moyen des missions',
      hint: 'Remplace le "budget moyen" — le budget annoncé par le client est un champ texte libre, jamais moyenné.',
      value: formatCurrency(r.averageMissionClientAmount.current),
      compared: r.averageMissionClientAmount,
      goodDirection: 'up' as const,
    },
    {
      key: 'cancelled',
      label: 'Demandes annulées',
      hint: null,
      value: formatNumber(r.cancelledRequests.current),
      compared: r.cancelledRequests,
      goodDirection: 'down' as const,
    },
  ];
});

const MIN_CHART_POINTS = 2;
const hasEnoughSeriesData = computed(
  () => (report.value?.requestsSeries.length ?? 0) >= MIN_CHART_POINTS,
);

const chartData = computed(() => {
  const series = report.value?.requestsSeries ?? [];
  return {
    labels: series.map((p) => p.date),
    datasets: [
      {
        label: 'Demandes par jour',
        data: series.map((p) => p.count),
        borderColor: resolveToken('--asb-gold-500'),
        backgroundColor: resolveToken('--asb-gold-50'),
        tension: 0.3,
        fill: true,
      },
    ],
  };
});
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};

const exporting = ref<string | null>(null);
async function exportCsv(table?: string): Promise<void> {
  exporting.value = table ?? 'requestsSeries';
  try {
    await downloadReportCsv('commercial', { from: props.from, to: props.to }, table);
  } finally {
    exporting.value = null;
  }
}
</script>

<template>
  <div class="commercial-panel">
    <div v-if="loading && !report" class="tiles-grid">
      <Skeleton v-for="n in 4" :key="n" height="6.5rem" />
    </div>
    <Message v-else-if="error" severity="error" :closable="false">
      Impossible de charger les indicateurs. <a href="#" @click.prevent="load">Réessayer</a>.
    </Message>
    <template v-else-if="report">
      <div class="tiles-grid">
        <div v-for="tile in tiles" :key="tile.key" class="kpi-tile" :title="tile.hint ?? undefined">
          <span class="kpi-tile__label">{{ tile.label }}</span>
          <span class="kpi-tile__value">{{ tile.value }}</span>
          <span
            class="kpi-tile__delta"
            :class="`kpi-tile__delta--${deltaSeverity(tile.compared, tile.goodDirection)}`"
          >
            {{ formatDeltaPercent(tile.compared.deltaPercent) }}
          </span>
        </div>

        <!-- Réservé SUPER_ADMIN : `revenue`/`commission` sont ABSENTS du JSON
             pour un ADMIN (voir CLAUDE.md §A4) — masqués, pas grisés. -->
        <div v-if="report.revenue" class="kpi-tile kpi-tile--gold">
          <span class="kpi-tile__label">Chiffre d'affaires réalisé</span>
          <span class="kpi-tile__value">{{ formatCurrency(report.revenue.realized.current) }}</span>
          <span class="kpi-tile__sub">
            Prévisionnel : {{ formatCurrency(report.revenue.forecast.current) }}
          </span>
        </div>
        <div v-if="report.commission" class="kpi-tile kpi-tile--gold">
          <span class="kpi-tile__label">Commission agence réalisée</span>
          <span class="kpi-tile__value">{{ formatCurrency(report.commission.realized.current) }}</span>
          <span class="kpi-tile__sub">
            Prévisionnelle : {{ formatCurrency(report.commission.forecast.current) }}
          </span>
        </div>
      </div>

      <section class="chart-section">
        <div class="chart-section__header">
          <h2>Demandes reçues par jour</h2>
          <Button
            label="CSV"
            icon="pi pi-download"
            size="small"
            severity="secondary"
            outlined
            :loading="exporting === 'requestsSeries'"
            @click="exportCsv('requestsSeries')"
          />
        </div>
        <Chart
          v-if="hasEnoughSeriesData"
          type="line"
          :data="chartData"
          :options="chartOptions"
          style="height: 260px"
        />
        <div v-else class="not-enough-data">
          <span class="not-enough-data__icon"><i class="pi pi-chart-line" /></span>
          <p class="not-enough-data__title">Pas encore assez de données sur cette période</p>
          <p class="not-enough-data__text">
            Élargissez la période pour voir apparaître une tendance lisible.
          </p>
        </div>
      </section>

      <section class="rankings-grid">
        <div class="ranking-card">
          <div class="ranking-card__header">
            <h3>Par type de prestation</h3>
            <Button icon="pi pi-download" text size="small" :loading="exporting === 'requestsByServiceType'" @click="exportCsv('requestsByServiceType')" />
          </div>
          <p v-if="report.requestsByServiceType.length === 0" class="ranking-card__empty">Pas assez de données sur cette période.</p>
          <ul v-else class="ranking-list">
            <li v-for="item in report.requestsByServiceType" :key="item.id">
              <span>{{ item.label }}</span><span class="ranking-list__count">{{ item.count }}</span>
            </li>
          </ul>
        </div>
        <div class="ranking-card">
          <div class="ranking-card__header">
            <h3>Organisations clientes principales</h3>
            <Button icon="pi pi-download" text size="small" :loading="exporting === 'topClientOrganizations'" @click="exportCsv('topClientOrganizations')" />
          </div>
          <p v-if="report.topClientOrganizations.length === 0" class="ranking-card__empty">Pas assez de données sur cette période.</p>
          <ul v-else class="ranking-list">
            <li v-for="item in report.topClientOrganizations" :key="item.id">
              <span>{{ item.label }}</span><span class="ranking-list__count">{{ item.count }}</span>
            </li>
          </ul>
        </div>
        <div class="ranking-card">
          <div class="ranking-card__header">
            <h3>Speakers les plus réservés</h3>
            <Button icon="pi pi-download" text size="small" :loading="exporting === 'topBookedSpeakers'" @click="exportCsv('topBookedSpeakers')" />
          </div>
          <p v-if="report.topBookedSpeakers.length === 0" class="ranking-card__empty">Pas assez de données sur cette période.</p>
          <ul v-else class="ranking-list">
            <li v-for="item in report.topBookedSpeakers" :key="item.id">
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

.kpi-tile--gold {
  border-left: 3px solid var(--asb-gold-500);
  background: var(--asb-gold-50);
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

.kpi-tile__sub {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

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
</style>
