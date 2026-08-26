<script setup lang="ts">
// 1. Liste des organisations (module Clients, ligne 5.12 — périmètre
// resserré : consultation et rattachement, pas de CRUD en libre-service).
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Paginator from 'primevue/paginator';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useApiList } from '../../composables/useApiList';
import { fetchOrganizations, type OrganizationListItem } from '../../services/organizations';
import { useTaxonomiesStore } from '../../stores/taxonomies';

const router = useRouter();
const taxonomies = useTaxonomiesStore();
onMounted(() => {
  void taxonomies.ensureLoaded();
});

const list = useApiList<OrganizationListItem, Record<string, string | undefined>>({
  fetcher: (params) =>
    fetchOrganizations({
      page: params.page,
      perPage: params.perPage,
      search: params.search,
      sector: params.sector,
      countryId: params.countryId,
      assignedAdminId: params.assignedAdminId,
    }),
  defaultFilters: {
    search: '',
    sector: '',
    countryId: '',
    assignedAdminId: '',
  },
  defaultPerPage: 25,
});

const countryOptions = computed(() =>
  taxonomies.countries.map((c) => ({ value: String(c.id), label: c.name })),
);
const adminOptions = computed(() =>
  taxonomies.admins.map((a) => ({ value: String(a.id), label: taxonomies.adminName(a) })),
);

const FILTER_LABELS: Record<string, string> = {
  sector: 'Secteur',
  countryId: 'Pays',
  assignedAdminId: 'Administrateur',
};
function filterChipValue(key: string, value: string): string {
  if (key === 'countryId') {
    return taxonomies.countries.find((c) => String(c.id) === value)?.name ?? value;
  }
  if (key === 'assignedAdminId') {
    const admin = taxonomies.admins.find((a) => String(a.id) === value);
    return admin ? taxonomies.adminName(admin) : value;
  }
  return value;
}
const activeChips = computed(() =>
  Object.entries(list.filters)
    .filter(([key, v]) => key !== 'search' && v !== undefined && v !== '')
    .map(([key, value]) => ({
      key,
      label: FILTER_LABELS[key] ?? key,
      value: filterChipValue(key, value as string),
    })),
);
function removeChip(key: string): void {
  list.setFilter(key, '');
}

const filterPanel = ref<InstanceType<typeof Popover> | null>(null);
function toggleFilterPanel(event: Event): void {
  filterPanel.value?.toggle(event);
}

function openDetail(org: OrganizationListItem): void {
  void router.push({ name: 'organization-detail', params: { id: org.id } });
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—';
}
</script>

<template>
  <div class="clients-list">
    <div class="clients-list__header">
      <h1 class="clients-list__title">Clients</h1>
    </div>

    <div class="clients-list__toolbar">
      <InputText
        :model-value="list.filters.search"
        placeholder="Rechercher une organisation…"
        class="clients-list__search"
        @update:model-value="(v) => list.setFilter('search', (v as string) ?? '')"
      />

      <template v-for="chip in activeChips" :key="chip.key">
        <button type="button" class="filter-chip" @click="removeChip(chip.key)">
          {{ chip.label }} : {{ chip.value }} <i class="pi pi-times" />
        </button>
      </template>

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
          <label>Secteur</label>
          <InputText
            :model-value="list.filters.sector"
            placeholder="Ex. Banque, Tech…"
            @update:model-value="(v) => list.setFilter('sector', (v as string) ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Pays</label>
          <Select
            :model-value="list.filters.countryId"
            :options="countryOptions"
            option-label="label"
            option-value="value"
            filter
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('countryId', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Administrateur</label>
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
        <Button label="Réinitialiser les filtres" text size="small" @click="list.resetFilters()" />
      </div>
    </Popover>

    <div class="clients-list__table">
      <div v-if="list.error.value" class="state-block state-block--error">
        <span class="state-block__icon state-block__icon--error">!</span>
        <div class="state-block__title">Impossible de charger les organisations</div>
        <Message severity="error" variant="simple" size="small">{{
          (list.error.value as Error)?.message ?? 'Erreur inconnue.'
        }}</Message>
        <Button label="Réessayer" size="small" @click="list.refresh()" />
      </div>

      <div v-else-if="list.loading.value" class="state-block">
        <div v-for="n in 6" :key="n" class="skeleton-row">
          <Skeleton height="0.85rem" width="10rem" />
          <Skeleton height="0.85rem" />
          <Skeleton width="4rem" height="0.85rem" />
        </div>
      </div>

      <div v-else-if="list.isEmptyBecauseFiltered.value" class="state-block">
        <span class="state-block__icon">⌕</span>
        <div class="state-block__title">Aucune organisation ne correspond</div>
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
        <div class="state-block__title">Aucune organisation pour l'instant</div>
        <p class="state-block__text">
          Une fiche organisation se crée depuis le rattachement d'une demande
          client (bloc « Client » de la fiche demande).
        </p>
      </div>

      <DataTable
        v-else
        :value="list.items.value"
        data-key="id"
        row-hover
        class="clients-table"
        @row-click="(e) => openDetail(e.data as OrganizationListItem)"
      >
        <Column field="name" header="Nom" style="min-width: 200px" />
        <Column header="Secteur" style="min-width: 120px">
          <template #body="{ data }: { data: OrganizationListItem }">
            {{ data.sector ?? '—' }}
          </template>
        </Column>
        <Column header="Pays" style="min-width: 120px">
          <template #body="{ data }: { data: OrganizationListItem }">
            {{ data.country?.name ?? '—' }}
          </template>
        </Column>
        <Column header="Demandes" style="min-width: 100px">
          <template #body="{ data }: { data: OrganizationListItem }">
            {{ data.bookingRequestsCount }}
          </template>
        </Column>
        <Column header="Missions" style="min-width: 100px">
          <template #body="{ data }: { data: OrganizationListItem }">
            {{ data.missionsCount }}
          </template>
        </Column>
        <Column header="Administrateur" style="min-width: 160px">
          <template #body="{ data }: { data: OrganizationListItem }">
            {{ data.assignedAdmin ? `${data.assignedAdmin.firstName ?? ''} ${data.assignedAdmin.lastName ?? ''}`.trim() || data.assignedAdmin.email : '—' }}
          </template>
        </Column>
        <Column header="Dernière activité" style="min-width: 140px">
          <template #body="{ data }: { data: OrganizationListItem }">
            {{ formatDate(data.lastActivityAt) }}
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
.clients-list__header {
  margin-bottom: var(--asb-space-4);
}

.clients-list__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.clients-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-2);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-2);
}

.clients-list__search {
  min-width: 260px;
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

.clients-list__table {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  border-top: none;
}

:deep(.p-datatable-tbody > tr) {
  cursor: pointer;
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
  max-width: 420px;
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
