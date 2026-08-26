<script setup lang="ts">
// 2. Liste des missions (module Missions, périmètre resserré : voir prompt
// -- consultation, pilotage des statuts, checklist, documents, messages ;
// PAS d'édition complète des champs).
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Select from 'primevue/select';
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Paginator from 'primevue/paginator';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import ProgressBar from 'primevue/progressbar';
import Avatar from 'primevue/avatar';
import ToggleSwitch from 'primevue/toggleswitch';
import StatusTag from '../../components/StatusTag.vue';
import { useApiList } from '../../composables/useApiList';
import { fetchMissions, type MissionListItem } from '../../services/missions';
import { fetchSpeakers, type SpeakerListItem } from '../../services/speakers';
import { suggestOrganizations, type OrganizationSuggestion } from '../../services/organizations';
import {
  missionStatusInfo,
  MISSION_STATUS,
  MISSION_CONTRACT_STATUS,
  MISSION_PAYMENT_STATUS,
} from '../../config/mission-status';
import { SERVICE_TYPE_LABELS } from '../../config/booking-status';

const router = useRouter();

const list = useApiList<MissionListItem, Record<string, string | undefined>>({
  fetcher: (params) =>
    fetchMissions({
      page: params.page,
      perPage: params.perPage,
      status: params.status,
      contractStatus: params.contractStatus,
      paymentStatus: params.paymentStatus,
      speakerId: params.speakerId,
      organizationId: params.organizationId,
      upcoming: params.upcoming,
      past: params.past,
    }),
  defaultFilters: {
    status: '',
    contractStatus: '',
    paymentStatus: '',
    speakerId: '',
    organizationId: '',
    upcoming: '',
    past: '',
  },
  defaultPerPage: 25,
});

const statusOptions = Object.entries(MISSION_STATUS).map(([value, info]) => ({
  value,
  label: info.label,
}));
const contractStatusOptions = Object.entries(MISSION_CONTRACT_STATUS).map(
  ([value, info]) => ({ value, label: info.label }),
);
const paymentStatusOptions = Object.entries(MISSION_PAYMENT_STATUS).map(
  ([value, info]) => ({ value, label: info.label }),
);

// Autocomplétion speaker / organisation (pas de select "toutes options" --
// aucune liste légère de ce type n'existe, recherche-au-clavier à la place).
const speakerSuggestions = ref<SpeakerListItem[]>([]);
const selectedSpeakerLabel = ref('');
async function searchSpeakers(event: AutoCompleteCompleteEvent): Promise<void> {
  const res = await fetchSpeakers({ page: 1, perPage: 10, search: event.query });
  speakerSuggestions.value = res.data;
}
function onSpeakerSelect(speaker: SpeakerListItem): void {
  list.setFilter('speakerId', String(speaker.id));
  selectedSpeakerLabel.value = speaker.displayName;
}
function clearSpeakerFilter(): void {
  list.setFilter('speakerId', '');
  selectedSpeakerLabel.value = '';
}

const organizationSuggestions = ref<OrganizationSuggestion[]>([]);
const selectedOrganizationLabel = ref('');
async function searchOrganizations(event: AutoCompleteCompleteEvent): Promise<void> {
  organizationSuggestions.value = await suggestOrganizations(event.query);
}
function onOrganizationSelect(org: OrganizationSuggestion): void {
  list.setFilter('organizationId', String(org.id));
  selectedOrganizationLabel.value = org.name;
}
function clearOrganizationFilter(): void {
  list.setFilter('organizationId', '');
  selectedOrganizationLabel.value = '';
}

const FILTER_LABELS: Record<string, string> = {
  status: 'Statut',
  contractStatus: 'Contrat',
  paymentStatus: 'Paiement',
  speakerId: 'Speaker',
  organizationId: 'Organisation',
  upcoming: 'À venir',
  past: 'Passées',
};
function filterChipValue(key: string, value: string): string {
  if (key === 'status') return missionStatusInfo(value).label;
  if (key === 'contractStatus') return MISSION_CONTRACT_STATUS[value]?.label ?? value;
  if (key === 'paymentStatus') return MISSION_PAYMENT_STATUS[value]?.label ?? value;
  if (key === 'speakerId') return selectedSpeakerLabel.value || value;
  if (key === 'organizationId') return selectedOrganizationLabel.value || value;
  if (key === 'upcoming' || key === 'past') return 'Oui';
  return value;
}
const activeChips = computed(() =>
  Object.entries(list.filters)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([key, value]) => ({
      key,
      label: FILTER_LABELS[key] ?? key,
      value: filterChipValue(key, value as string),
    })),
);
const CHIP_VISIBLE_LIMIT = 3;
const visibleChips = computed(() => activeChips.value.slice(0, CHIP_VISIBLE_LIMIT));
const overflowChipCount = computed(() =>
  Math.max(0, activeChips.value.length - CHIP_VISIBLE_LIMIT),
);
function removeChip(key: string): void {
  if (key === 'speakerId') clearSpeakerFilter();
  else if (key === 'organizationId') clearOrganizationFilter();
  else list.setFilter(key, '');
}

const filterPanel = ref<InstanceType<typeof Popover> | null>(null);
function toggleFilterPanel(event: Event): void {
  filterPanel.value?.toggle(event);
}

function openDetail(mission: MissionListItem): void {
  void router.push({ name: 'mission-detail', params: { id: mission.id } });
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—';
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
</script>

<template>
  <div class="missions-list">
    <div class="missions-list__header">
      <h1 class="missions-list__title">Missions</h1>
    </div>

    <div class="missions-list__toolbar">
      <template v-for="chip in visibleChips" :key="chip.key">
        <button type="button" class="filter-chip" @click="removeChip(chip.key)">
          {{ chip.label }} : {{ chip.value }} <i class="pi pi-times" />
        </button>
      </template>
      <button
        v-if="overflowChipCount > 0"
        type="button"
        class="filter-chip filter-chip--overflow"
        @click="toggleFilterPanel"
      >
        + {{ overflowChipCount }} filtres
      </button>

      <Button
        label="Filtres"
        icon="pi pi-filter"
        severity="secondary"
        outlined
        size="small"
        @click="toggleFilterPanel"
      />

      <span class="missions-list__spacer" />

      <div class="period-toggles">
        <ToggleSwitch
          :model-value="list.filters.upcoming === 'true'"
          @update:model-value="
            (v: boolean) => {
              list.setFilter('upcoming', v ? 'true' : '');
              if (v) list.setFilter('past', '');
            }
          "
        />
        <span>À venir</span>
        <ToggleSwitch
          :model-value="list.filters.past === 'true'"
          @update:model-value="
            (v: boolean) => {
              list.setFilter('past', v ? 'true' : '');
              if (v) list.setFilter('upcoming', '');
            }
          "
        />
        <span>Passées</span>
      </div>
    </div>

    <Popover ref="filterPanel">
      <div class="filter-panel">
        <div class="filter-panel__field">
          <label>Statut</label>
          <Select
            :model-value="list.filters.status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('status', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Contrat</label>
          <Select
            :model-value="list.filters.contractStatus"
            :options="contractStatusOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('contractStatus', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Paiement</label>
          <Select
            :model-value="list.filters.paymentStatus"
            :options="paymentStatusOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('paymentStatus', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Speaker</label>
          <AutoComplete
            v-model="selectedSpeakerLabel"
            :suggestions="speakerSuggestions"
            option-label="displayName"
            placeholder="Rechercher…"
            @complete="searchSpeakers"
            @item-select="(e) => onSpeakerSelect(e.value as SpeakerListItem)"
            @clear="clearSpeakerFilter"
          />
        </div>
        <div class="filter-panel__field">
          <label>Organisation</label>
          <AutoComplete
            v-model="selectedOrganizationLabel"
            :suggestions="organizationSuggestions"
            option-label="name"
            placeholder="Rechercher…"
            @complete="searchOrganizations"
            @item-select="(e) => onOrganizationSelect(e.value as OrganizationSuggestion)"
            @clear="clearOrganizationFilter"
          />
        </div>
        <Button
          label="Réinitialiser les filtres"
          text
          size="small"
          @click="
            () => {
              list.resetFilters();
              clearSpeakerFilter();
              clearOrganizationFilter();
            }
          "
        />
      </div>
    </Popover>

    <div class="missions-list__table">
      <div v-if="list.error.value" class="state-block state-block--error">
        <span class="state-block__icon state-block__icon--error">!</span>
        <div class="state-block__title">Impossible de charger les missions</div>
        <Message severity="error" variant="simple" size="small">{{
          (list.error.value as Error)?.message ?? 'Erreur inconnue.'
        }}</Message>
        <Button label="Réessayer" size="small" @click="list.refresh()" />
      </div>

      <div v-else-if="list.loading.value" class="state-block">
        <div v-for="n in 6" :key="n" class="skeleton-row">
          <Skeleton height="0.85rem" width="6rem" />
          <Skeleton height="0.85rem" />
          <Skeleton width="4rem" height="0.85rem" />
        </div>
      </div>

      <div v-else-if="list.isEmptyBecauseFiltered.value" class="state-block">
        <span class="state-block__icon">⌕</span>
        <div class="state-block__title">Aucune mission ne correspond</div>
        <Button
          label="Réinitialiser les filtres"
          size="small"
          severity="secondary"
          outlined
          @click="list.resetFilters()"
        />
      </div>

      <div v-else-if="list.isEmpty.value" class="state-block">
        <span class="state-block__icon">＋</span>
        <div class="state-block__title">Aucune mission pour l'instant</div>
        <p class="state-block__text">
          Une mission se crée depuis une demande client confirmée, une fois un
          speaker retenu.
        </p>
      </div>

      <DataTable
        v-else
        :value="list.items.value"
        data-key="id"
        row-hover
        class="missions-table"
        @row-click="(e) => openDetail(e.data as MissionListItem)"
      >
        <Column field="reference" header="Référence" style="min-width: 140px" />
        <Column header="Speaker" style="min-width: 200px">
          <template #body="{ data }: { data: MissionListItem }">
            <div class="speaker-cell">
              <Avatar
                v-if="data.speaker.profilePhotoUrl"
                :image="data.speaker.profilePhotoUrl"
                shape="circle"
                size="normal"
              />
              <Avatar v-else :label="initials(data.speaker.displayName)" shape="circle" size="normal" />
              <span>{{ data.speaker.displayName }}</span>
            </div>
          </template>
        </Column>
        <Column header="Organisation" style="min-width: 160px">
          <template #body="{ data }: { data: MissionListItem }">
            {{ data.organization?.name ?? '—' }}
          </template>
        </Column>
        <Column header="Prestation" style="min-width: 130px">
          <template #body="{ data }: { data: MissionListItem }">
            {{ SERVICE_TYPE_LABELS[data.serviceType] ?? data.serviceType }}
          </template>
        </Column>
        <Column header="Événement" style="min-width: 120px">
          <template #body="{ data }: { data: MissionListItem }">
            {{ formatDate(data.eventDate) }}
          </template>
        </Column>
        <Column header="Lieu" style="min-width: 130px">
          <template #body="{ data }: { data: MissionListItem }">
            {{ data.isVirtual ? 'Distanciel' : (data.locationCountryName ?? '—') }}
          </template>
        </Column>
        <Column header="Statut" style="min-width: 160px">
          <template #body="{ data }: { data: MissionListItem }">
            <StatusTag
              :label="missionStatusInfo(data.status).label"
              :family="missionStatusInfo(data.status).family"
            />
          </template>
        </Column>
        <Column header="Checklist" style="min-width: 130px">
          <template #body="{ data }: { data: MissionListItem }">
            <div class="checklist-cell">
              <ProgressBar
                :value="data.checklistProgressPercent"
                :show-value="false"
                style="height: 6px"
              />
              <span>{{ data.checklistProgressPercent }} %</span>
            </div>
          </template>
        </Column>
      </DataTable>

      <Paginator
        v-if="!list.isEmpty.value && !list.loading.value"
        :rows="list.meta.value.perPage"
        :total-records="list.meta.value.total"
        :first="(list.page.value - 1) * list.meta.value.perPage"
        :rows-per-page-options="[25, 50, 100]"
        @page="(e) => { list.setPage(e.page + 1); list.perPage.value = e.rows; }"
      />
    </div>
  </div>
</template>

<style scoped>
.missions-list__header {
  margin-bottom: var(--asb-space-4);
}

.missions-list__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.missions-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-2);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-2);
}

.missions-list__spacer {
  flex: 1;
}

.period-toggles {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.filter-chip {
  height: 32px;
  padding: 0 var(--asb-space-2);
  display: inline-flex;
  align-items: center;
  gap: var(--asb-space-1);
  background: var(--asb-gold-50);
  border: 1px solid var(--asb-gold-300);
  color: var(--asb-gold-700);
  font-size: var(--asb-text-sm);
  font-weight: 600;
  border-radius: var(--asb-radius-sm);
  cursor: pointer;
}

.filter-chip--overflow {
  background: var(--asb-surface-card);
  border-color: var(--asb-border-strong);
  color: var(--asb-text-muted);
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
  min-width: 220px;
  padding: var(--asb-space-2);
}

.filter-panel__field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.filter-panel__field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.missions-list__table {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  border-top: none;
}

:deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.speaker-cell {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
}

.checklist-cell {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.checklist-cell :deep(.p-progressbar) {
  flex: 1;
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

.state-block__icon--error {
  border-color: var(--asb-danger-600);
  background: var(--asb-danger-50);
  color: var(--asb-danger-600);
  font-weight: 700;
}

.state-block__title {
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}

.state-block__text {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  padding: var(--asb-space-2) var(--asb-space-4);
}
</style>
