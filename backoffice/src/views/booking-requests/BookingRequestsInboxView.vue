<script setup lang="ts">
// 3.2 Inbox des demandes clients.
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DataTable, { type DataTableSortEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Paginator from 'primevue/paginator';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import ToggleSwitch from 'primevue/toggleswitch';
import StatusTag from '../../components/StatusTag.vue';
import { useApiList } from '../../composables/useApiList';
import { useTaxonomiesStore } from '../../stores/taxonomies';
import {
  fetchBookingRequests,
  type BookingRequestListItem,
} from '../../services/booking-requests';
import {
  bookingStatusInfo,
  priorityInfo,
  SERVICE_TYPE_LABELS,
  BOOKING_STATUS,
  PRIORITY_INFO,
} from '../../config/booking-status';

const router = useRouter();
const taxonomies = useTaxonomiesStore();
onMounted(() => {
  void taxonomies.ensureLoaded();
});

const list = useApiList<BookingRequestListItem, Record<string, string | undefined>>({
  fetcher: (params) =>
    fetchBookingRequests({
      page: params.page,
      perPage: params.perPage,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      search: params.search,
      serviceType: params.serviceType,
      status: params.status,
      priority: params.priority,
      assignedAdminId: params.assignedAdminId,
      overdue: params.overdue,
    }),
  defaultFilters: {
    search: '',
    serviceType: '',
    status: '',
    priority: '',
    assignedAdminId: '',
    overdue: '',
  },
  defaultPerPage: 25,
  defaultSortBy: 'receivedAt',
  defaultSortOrder: 'desc',
});

const statusOptions = Object.entries(BOOKING_STATUS).map(([value, info]) => ({
  value,
  label: info.label,
}));
const priorityOptions = Object.entries(PRIORITY_INFO).map(([value, info]) => ({
  value,
  label: info.label,
}));
const serviceTypeOptions = Object.entries(SERVICE_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const adminOptions = computed(() =>
  taxonomies.admins.map((a) => ({
    value: String(a.id),
    label: taxonomies.adminName(a),
  })),
);

const FILTER_LABELS: Record<string, string> = {
  search: 'Recherche',
  serviceType: 'Service',
  status: 'Statut',
  priority: 'Priorité',
  assignedAdminId: 'Assigné à',
  overdue: 'En retard',
};
function filterChipValue(key: string, value: string): string {
  if (key === 'serviceType') return SERVICE_TYPE_LABELS[value] ?? value;
  if (key === 'status') return bookingStatusInfo(value).label;
  if (key === 'priority') return priorityInfo(value).label;
  if (key === 'assignedAdminId')
    return adminOptions.value.find((o) => o.value === value)?.label ?? value;
  if (key === 'overdue') return 'Oui';
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

function onSort(event: DataTableSortEvent): void {
  if (!event.sortField || typeof event.sortField !== 'string') return;
  const map: Record<string, string> = {
    createdAt: 'receivedAt',
    eventDate: 'eventDate',
    priority: 'priority',
    responseDueAt: 'responseDueAt',
  };
  list.sortBy.value = map[event.sortField] ?? event.sortField;
  list.sortOrder.value = event.sortOrder === -1 ? 'desc' : 'asc';
  list.page.value = 1;
}

function openDetail(request: BookingRequestListItem): void {
  void router.push({ name: 'booking-request-detail', params: { id: request.id } });
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—';
}
</script>

<template>
  <div class="inbox">
    <div class="inbox__header">
      <h1 class="inbox__title">Demandes clients</h1>
    </div>

    <div class="inbox__toolbar">
      <InputText
        :model-value="list.filters.search"
        placeholder="Nom, organisation, e-mail, référence…"
        class="inbox__search"
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

      <span class="inbox__spacer" />

      <div class="overdue-toggle">
        <ToggleSwitch
          :model-value="list.filters.overdue === 'true'"
          @update:model-value="(v: boolean) => list.setFilter('overdue', v ? 'true' : '')"
        />
        <span>En retard uniquement</span>
      </div>
    </div>

    <Popover ref="filterPanel">
      <div class="filter-panel">
        <div class="filter-panel__field">
          <label>Service</label>
          <Select
            :model-value="list.filters.serviceType"
            :options="serviceTypeOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('serviceType', v ?? '')"
          />
        </div>
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
          <label>Priorité</label>
          <Select
            :model-value="list.filters.priority"
            :options="priorityOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Toutes"
            @update:model-value="(v) => list.setFilter('priority', v ?? '')"
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
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('assignedAdminId', v ?? '')"
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

    <div class="inbox__table">
      <div v-if="list.error.value" class="state-block state-block--error">
        <span class="state-block__icon state-block__icon--error">!</span>
        <div class="state-block__title">Impossible de charger les demandes</div>
        <Message severity="error" variant="simple" size="small">{{
          (list.error.value as Error)?.message ?? 'Erreur inconnue.'
        }}</Message>
        <Button label="Réessayer" size="small" @click="list.refresh()" />
      </div>

      <div v-else-if="list.loading.value" class="state-block">
        <div v-for="n in 6" :key="n" class="skeleton-row">
          <Skeleton height="0.85rem" width="5rem" />
          <Skeleton height="0.85rem" />
          <Skeleton width="4rem" height="0.85rem" />
        </div>
      </div>

      <div v-else-if="list.isEmptyBecauseFiltered.value" class="state-block">
        <span class="state-block__icon">⌕</span>
        <div class="state-block__title">Aucune demande ne correspond</div>
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
        <div class="state-block__title">Aucune demande pour l'instant</div>
        <p class="state-block__text">
          Les demandes reçues via le site public apparaîtront ici.
        </p>
      </div>

      <DataTable
        v-else
        :value="list.items.value"
        data-key="id"
        row-hover
        sort-mode="single"
        class="inbox-table"
        :row-class="(data: BookingRequestListItem) => (data.isOverdue ? 'inbox-row--overdue' : '')"
        @sort="onSort"
        @row-click="(e) => openDetail(e.data as BookingRequestListItem)"
      >
        <Column field="reference" header="Référence" sortable style="min-width: 140px" />
        <Column header="Client" style="min-width: 220px">
          <template #body="{ data }: { data: BookingRequestListItem }">
            <div class="client-cell">
              <span class="client-cell__name">{{ data.fullName }}</span>
              <span class="client-cell__org">{{ data.organization }}</span>
            </div>
          </template>
        </Column>
        <Column header="Service" style="min-width: 120px">
          <template #body="{ data }: { data: BookingRequestListItem }">
            {{ SERVICE_TYPE_LABELS[data.serviceType] ?? data.serviceType }}
          </template>
        </Column>
        <Column field="eventDate" header="Événement" sortable style="min-width: 120px">
          <template #body="{ data }: { data: BookingRequestListItem }">
            {{ formatDate(data.eventDate) }}
          </template>
        </Column>
        <Column header="Priorité" field="priority" sortable style="min-width: 110px">
          <template #body="{ data }: { data: BookingRequestListItem }">
            <StatusTag
              :label="priorityInfo(data.priority).label"
              :family="priorityInfo(data.priority).family"
            />
          </template>
        </Column>
        <Column header="Statut" style="min-width: 170px">
          <template #body="{ data }: { data: BookingRequestListItem }">
            <StatusTag
              :label="bookingStatusInfo(data.status).label"
              :family="bookingStatusInfo(data.status).family"
            />
          </template>
        </Column>
        <Column header="Assignée à" style="min-width: 140px">
          <template #body="{ data }: { data: BookingRequestListItem }">
            {{ data.assignedAdmin ? taxonomies.adminName(data.assignedAdmin) : '—' }}
          </template>
        </Column>
        <Column header="Échéance" field="responseDueAt" sortable style="min-width: 130px">
          <template #body="{ data }: { data: BookingRequestListItem }">
            <span :class="{ 'overdue-text': data.isOverdue }">
              <i v-if="data.isOverdue" class="pi pi-exclamation-triangle" />
              {{ formatDate(data.responseDueAt) }}
            </span>
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
.inbox__header {
  margin-bottom: var(--asb-space-4);
}

.inbox__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.inbox__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-2);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-2);
}

.inbox__search {
  width: 260px;
}

.inbox__spacer {
  flex: 1;
}

.overdue-toggle {
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

.inbox__table {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  border-top: none;
}

:deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

:deep(.inbox-row--overdue) {
  box-shadow: inset 3px 0 0 var(--asb-danger-600);
  background: var(--asb-danger-50);
}

.client-cell {
  display: flex;
  flex-direction: column;
}

.client-cell__name {
  font-weight: 600;
  color: var(--asb-text);
}

.client-cell__org {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.overdue-text {
  color: var(--asb-danger-600);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
