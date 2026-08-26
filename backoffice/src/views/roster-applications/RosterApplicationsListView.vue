<script setup lang="ts">
// 4.1 Liste des candidatures.
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Paginator from 'primevue/paginator';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import StatusTag from '../../components/StatusTag.vue';
import { useApiList } from '../../composables/useApiList';
import { useTaxonomiesStore } from '../../stores/taxonomies';
import {
  fetchRosterApplications,
  type RosterApplicationListItem,
} from '../../services/roster-applications';
import {
  applicationStatusInfo,
  APPLICATION_STATUS,
} from '../../config/roster-application-status';

const router = useRouter();
const taxonomies = useTaxonomiesStore();
onMounted(() => {
  void taxonomies.ensureLoaded();
});

const list = useApiList<RosterApplicationListItem, Record<string, string | undefined>>({
  fetcher: (params) =>
    fetchRosterApplications({
      page: params.page,
      perPage: params.perPage,
      status: params.status,
      country: params.country,
      assignedAdminId: params.assignedAdminId,
      minScore: params.minScore,
      search: params.search,
    }),
  defaultFilters: {
    search: '',
    status: '',
    country: '',
    assignedAdminId: '',
    minScore: '',
  },
  defaultPerPage: 25,
});

const statusOptions = Object.entries(APPLICATION_STATUS).map(([value, info]) => ({
  value,
  label: info.label,
}));
const adminOptions = computed(() =>
  taxonomies.admins.map((a) => ({
    value: String(a.id),
    label: taxonomies.adminName(a),
  })),
);

const FILTER_LABELS: Record<string, string> = {
  search: 'Recherche',
  status: 'Statut',
  country: 'Pays',
  assignedAdminId: 'Assignée à',
  minScore: 'Score min.',
};
function filterChipValue(key: string, value: string): string {
  if (key === 'status') return applicationStatusInfo(value).label;
  if (key === 'assignedAdminId')
    return adminOptions.value.find((o) => o.value === value)?.label ?? value;
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
  list.setFilter(key, '');
}

const filterPanel = ref<InstanceType<typeof Popover> | null>(null);
function toggleFilterPanel(event: Event): void {
  filterPanel.value?.toggle(event);
}

function openDetail(application: RosterApplicationListItem): void {
  void router.push({ name: 'roster-application-detail', params: { id: application.id } });
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—';
}
</script>

<template>
  <div class="applications-list">
    <div class="applications-list__header">
      <h1 class="applications-list__title">Candidatures</h1>
    </div>

    <div class="applications-list__toolbar">
      <InputText
        :model-value="list.filters.search"
        placeholder="Nom, organisation, e-mail, référence…"
        class="applications-list__search"
        @update:model-value="(v) => list.setFilter('search', (v as string) ?? '')"
      />

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
          <label>Pays (texte libre, tel que déclaré)</label>
          <InputText
            :model-value="list.filters.country"
            @update:model-value="(v) => list.setFilter('country', (v as string) ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Assignée à</label>
          <Select
            :model-value="list.filters.assignedAdminId"
            :options="adminOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Toutes"
            @update:model-value="(v) => list.setFilter('assignedAdminId', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Score agrégé minimum</label>
          <InputNumber
            :model-value="list.filters.minScore ? Number(list.filters.minScore) : null"
            :min="1"
            :max="5"
            @update:model-value="(v) => list.setFilter('minScore', v ? String(v) : '')"
          />
        </div>
        <Button
          label="Réinitialiser les filtres"
          text
          size="small"
          @click="list.resetFilters()"
        />
      </div>
    </Popover>

    <div class="applications-list__table">
      <div v-if="list.error.value" class="state-block state-block--error">
        <span class="state-block__icon state-block__icon--error">!</span>
        <div class="state-block__title">Impossible de charger les candidatures</div>
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
        <div class="state-block__title">Aucune candidature ne correspond</div>
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
        <div class="state-block__title">Aucune candidature pour l'instant</div>
        <p class="state-block__text">
          Les candidatures reçues via le site public apparaîtront ici.
        </p>
      </div>

      <DataTable
        v-else
        :value="list.items.value"
        data-key="id"
        row-hover
        class="applications-table"
        @row-click="(e) => openDetail(e.data as RosterApplicationListItem)"
      >
        <Column field="reference" header="Référence" style="min-width: 140px" />
        <Column header="Candidat" style="min-width: 220px">
          <template #body="{ data }: { data: RosterApplicationListItem }">
            <div class="candidate-cell">
              <span class="candidate-cell__name"
                >{{ data.fullName }}
                <i
                  v-if="data.hasDuplicateEmail"
                  v-tooltip.top="'Cet e-mail correspond à une autre candidature ou un speaker existant'"
                  class="pi pi-exclamation-triangle candidate-cell__flag"
              /></span>
              <span class="candidate-cell__org">{{ data.organization ?? '—' }}</span>
            </div>
          </template>
        </Column>
        <Column header="Pays" style="min-width: 120px">
          <template #body="{ data }: { data: RosterApplicationListItem }">
            {{ data.country ?? '—' }}
          </template>
        </Column>
        <Column header="Expertise" style="min-width: 160px">
          <template #body="{ data }: { data: RosterApplicationListItem }">
            {{ data.expertiseArea ?? '—' }}
          </template>
        </Column>
        <Column header="Score" style="min-width: 90px">
          <template #body="{ data }: { data: RosterApplicationListItem }">
            <span class="score-cell">{{ data.aggregatedScore ?? '—' }}</span>
          </template>
        </Column>
        <Column header="Statut" style="min-width: 170px">
          <template #body="{ data }: { data: RosterApplicationListItem }">
            <StatusTag
              :label="applicationStatusInfo(data.status).label"
              :family="applicationStatusInfo(data.status).family"
            />
          </template>
        </Column>
        <Column header="Assignée à" style="min-width: 140px">
          <template #body="{ data }: { data: RosterApplicationListItem }">
            {{ data.assignedAdmin ? taxonomies.adminName(data.assignedAdmin) : '—' }}
          </template>
        </Column>
        <Column header="Reçue le" style="min-width: 120px">
          <template #body="{ data }: { data: RosterApplicationListItem }">
            {{ formatDate(data.createdAt) }}
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
.applications-list__header {
  margin-bottom: var(--asb-space-4);
}

.applications-list__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.applications-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-2);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-2);
}

.applications-list__search {
  width: 260px;
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

.applications-list__table {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  border-top: none;
}

:deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.candidate-cell {
  display: flex;
  flex-direction: column;
}

.candidate-cell__name {
  font-weight: 600;
  color: var(--asb-text);
  display: inline-flex;
  align-items: center;
  gap: var(--asb-space-1);
}

.candidate-cell__flag {
  color: var(--asb-warning-600);
  font-size: 12px;
}

.candidate-cell__org {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.score-cell {
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

.skeleton-row :deep(.p-skeleton:nth-child(2)) {
  flex: 1;
}
</style>
