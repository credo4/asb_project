<script setup lang="ts">
// Paramètres > Sécurité (§A3) : journal des connexions. Réservé
// SUPER_ADMIN côté API -- un ADMIN voit un message explicite plutôt qu'un
// appel voué à un 403 (même esprit que les infobulles de l'onglet
// Utilisateurs).
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Paginator from 'primevue/paginator';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { computed, ref } from 'vue';
import StatusTag from '../../../components/StatusTag.vue';
import { useApiList } from '../../../composables/useApiList';
import { useAuthStore } from '../../../stores/auth';
import { fetchLoginEvents, type LoginEventItem } from '../../../services/login-events';

const auth = useAuthStore();
const isSuperAdmin = computed(() => auth.user?.role === 'SUPER_ADMIN');

const list = useApiList<LoginEventItem, Record<string, string | undefined>>({
  fetcher: (params) =>
    fetchLoginEvents({
      page: params.page,
      perPage: params.perPage,
      success: params.success,
      email: params.email,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    }),
  defaultFilters: { success: '', email: '', dateFrom: '', dateTo: '' },
  defaultPerPage: 25,
});

const successOptions = [
  { value: 'true', label: 'Réussites' },
  { value: 'false', label: 'Échecs' },
];

const dateFrom = ref<Date | null>(null);
const dateTo = ref<Date | null>(null);
function toIsoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}
function applyDateFrom(value: unknown): void {
  const d = value instanceof Date ? value : null;
  dateFrom.value = d;
  list.setFilter('dateFrom', toIsoDate(d));
}
function applyDateTo(value: unknown): void {
  const d = value instanceof Date ? value : null;
  dateTo.value = d;
  list.setFilter('dateTo', toIsoDate(d));
}

const filterPanel = ref<InstanceType<typeof Popover> | null>(null);
function toggleFilterPanel(event: Event): void {
  filterPanel.value?.toggle(event);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR');
}

const FAILURE_REASON_LABELS: Record<string, string> = {
  UNKNOWN_EMAIL: 'E-mail inconnu',
  WRONG_PASSWORD: 'Mot de passe incorrect',
  NO_PASSWORD_SET: 'Mot de passe jamais défini',
  ACCOUNT_INVITED: 'Compte pas encore activé',
  ACCOUNT_SUSPENDED: 'Compte suspendu',
  ACCOUNT_DISABLED: 'Compte désactivé',
};
function failureReasonLabel(reason: string | null): string {
  if (!reason) return '—';
  return FAILURE_REASON_LABELS[reason] ?? reason;
}
</script>

<template>
  <div class="security-panel">
    <Message v-if="!isSuperAdmin" severity="info" :closable="false">
      Le journal des connexions est réservé aux super administrateurs.
    </Message>

    <template v-else>
      <div class="security-panel__toolbar">
        <InputText
          :model-value="list.filters.email"
          placeholder="Rechercher un e-mail…"
          class="security-panel__search"
          @update:model-value="(v) => list.setFilter('email', (v as string) ?? '')"
        />
        <Select
          :model-value="list.filters.success"
          :options="successOptions"
          option-label="label"
          option-value="value"
          show-clear
          placeholder="Tous"
          @update:model-value="(v) => list.setFilter('success', v ?? '')"
        />
        <Button label="Période" icon="pi pi-calendar" severity="secondary" outlined size="small" @click="toggleFilterPanel" />
      </div>

      <Popover ref="filterPanel">
        <div class="filter-panel">
          <div class="filter-panel__field">
            <label>Du</label>
            <DatePicker :model-value="dateFrom" date-format="yy-mm-dd" show-icon @update:model-value="applyDateFrom" />
          </div>
          <div class="filter-panel__field">
            <label>Au</label>
            <DatePicker :model-value="dateTo" date-format="yy-mm-dd" show-icon @update:model-value="applyDateTo" />
          </div>
        </div>
      </Popover>

      <div v-if="list.error.value" class="state-block state-block--error">
        <Message severity="error" variant="simple" size="small">{{
          (list.error.value as Error)?.message ?? 'Erreur inconnue.'
        }}</Message>
        <Button label="Réessayer" size="small" @click="list.refresh()" />
      </div>

      <div v-else-if="list.loading.value" class="state-block">
        <div v-for="n in 5" :key="n" class="skeleton-row">
          <Skeleton height="0.85rem" width="8rem" />
          <Skeleton height="0.85rem" />
        </div>
      </div>

      <div v-else-if="list.isEmpty.value" class="state-block">
        <span class="state-block__icon">⌕</span>
        <div class="state-block__title">Aucune tentative de connexion trouvée</div>
      </div>

      <DataTable v-else :value="list.items.value" data-key="id" class="events-table">
        <Column header="Date" style="min-width: 160px">
          <template #body="{ data }: { data: LoginEventItem }">
            {{ formatDateTime(data.createdAt) }}
          </template>
        </Column>
        <Column field="emailAttempted" header="E-mail tenté" style="min-width: 220px" />
        <Column header="Statut" style="min-width: 130px">
          <template #body="{ data }: { data: LoginEventItem }">
            <StatusTag
              :label="data.success ? 'Réussite' : 'Échec'"
              :family="data.success ? 'success' : 'danger'"
            />
          </template>
        </Column>
        <Column header="Motif" style="min-width: 180px">
          <template #body="{ data }: { data: LoginEventItem }">
            {{ failureReasonLabel(data.failureReason) }}
          </template>
        </Column>
        <Column header="Utilisateur" style="min-width: 180px">
          <template #body="{ data }: { data: LoginEventItem }">
            <template v-if="data.user">
              {{ [data.user.firstName, data.user.lastName].filter(Boolean).join(' ') || data.user.email }}
            </template>
            <template v-else>—</template>
          </template>
        </Column>
        <Column header="Agent utilisateur" style="min-width: 200px">
          <template #body="{ data }: { data: LoginEventItem }">
            <span class="mono-cell">{{ data.userAgent ?? '—' }}</span>
          </template>
        </Column>
        <Column header="Empreinte IP" style="min-width: 140px">
          <template #body="{ data }: { data: LoginEventItem }">
            <span v-if="data.ipHash" class="mono-cell" :title="data.ipHash">{{ data.ipHash.slice(0, 12) }}…</span>
            <template v-else>—</template>
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
    </template>
  </div>
</template>

<style scoped>
.security-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-2);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-2);
  margin-bottom: var(--asb-space-3);
}

.security-panel__search {
  min-width: 240px;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
  min-width: 200px;
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

.mono-cell {
  font-family: var(--asb-font-mono);
  font-size: 12px;
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

.skeleton-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  padding: var(--asb-space-2) var(--asb-space-4);
}
</style>
