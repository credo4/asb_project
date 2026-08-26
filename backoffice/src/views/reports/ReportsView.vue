<script setup lang="ts">
// Rapports et statistiques (ligne 5.13, Partie B) : trois onglets
// (Speakers/Commercial/Éditorial, `?tab=`), un sélecteur de période PARTAGÉ
// (`useReportPeriod`, `?preset=`/`?from=`/`?to=`) — même principe que les
// onglets de Paramètres (SettingsView.vue), mais avec un second morceau
// d'état d'URL en plus, tout aussi partageable par lien.
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import SelectButton from 'primevue/selectbutton';
import DatePicker from 'primevue/datepicker';
import {
  PERIOD_PRESETS,
  PERIOD_PRESET_LABELS,
  useReportPeriod,
  type PeriodPreset,
} from '../../composables/useReportPeriod';
import SpeakersReportPanel from './panels/SpeakersReportPanel.vue';
import CommercialReportPanel from './panels/CommercialReportPanel.vue';
import EditorialReportPanel from './panels/EditorialReportPanel.vue';

const route = useRoute();
const router = useRouter();

const VALID_TABS = ['speakers', 'commercial', 'editorial'] as const;
type TabKey = (typeof VALID_TABS)[number];

const activeTab = computed<TabKey>({
  get() {
    const raw = route.query.tab;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return (VALID_TABS as readonly string[]).includes(value ?? '')
      ? (value as TabKey)
      : 'speakers';
  },
  set(value: TabKey) {
    void router.replace({ query: { ...route.query, tab: value } });
  },
});

const { preset, range, setPreset, setCustomRange } = useReportPeriod();

const presetOptions = PERIOD_PRESETS.map((value) => ({
  value,
  label: PERIOD_PRESET_LABELS[value],
}));

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function applyCustomFrom(value: unknown): void {
  const d = value instanceof Date ? value : null;
  if (d) setCustomRange(toIso(d), range.value.to);
}
function applyCustomTo(value: unknown): void {
  const d = value instanceof Date ? value : null;
  if (d) setCustomRange(range.value.from, toIso(d));
}
</script>

<template>
  <div class="reports-view">
    <h1 class="reports-view__title">Rapports</h1>

    <div class="period-selector">
      <SelectButton
        :model-value="preset"
        :options="presetOptions"
        option-label="label"
        option-value="value"
        @update:model-value="(v) => v && setPreset(v as PeriodPreset)"
      />
      <template v-if="preset === 'custom'">
        <DatePicker
          :model-value="toDate(range.from)"
          date-format="yy-mm-dd"
          show-icon
          placeholder="Du"
          @update:model-value="applyCustomFrom"
        />
        <span class="period-selector__sep">→</span>
        <DatePicker
          :model-value="toDate(range.to)"
          date-format="yy-mm-dd"
          show-icon
          placeholder="Au"
          @update:model-value="applyCustomTo"
        />
      </template>
      <span class="period-selector__range">{{ range.from }} → {{ range.to }}</span>
    </div>

    <Tabs :value="activeTab" @update:value="(v) => (activeTab = v as TabKey)">
      <TabList>
        <Tab value="speakers">Speakers</Tab>
        <Tab value="commercial">Commercial</Tab>
        <Tab value="editorial">Éditorial</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="speakers">
          <SpeakersReportPanel :from="range.from" :to="range.to" />
        </TabPanel>
        <TabPanel value="commercial">
          <CommercialReportPanel :from="range.from" :to="range.to" />
        </TabPanel>
        <TabPanel value="editorial">
          <EditorialReportPanel :from="range.from" :to="range.to" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.reports-view__title {
  margin: 0 0 var(--asb-space-4);
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.period-selector {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-3);
  margin-bottom: var(--asb-space-4);
  padding: var(--asb-space-3);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
}

.period-selector__sep {
  color: var(--asb-text-muted);
}

.period-selector__range {
  margin-left: auto;
  font-family: var(--asb-font-mono);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}
</style>
