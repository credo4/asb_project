<script setup lang="ts">
// 3.1 File des profils à valider. C'est l'écran mis en avant en premier
// (voir prompt) : soigné, direct — une liste, un statut par défaut
// (SUBMITTED), un clic ouvre la comparaison.
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Skeleton from 'primevue/skeleton';
import Paginator from 'primevue/paginator';
import Message from 'primevue/message';
import StatusTag from '../../components/StatusTag.vue';
import { useApiList } from '../../composables/useApiList';
import { fetchRevisions, type RevisionListItem } from '../../services/speaker-revisions';
import { revisionStatusInfo, REVISION_STATUS } from '../../config/revision-status';

const router = useRouter();

const statusOptions = Object.entries(REVISION_STATUS).map(([value, info]) => ({
  value,
  label: info.label,
}));

const list = useApiList<RevisionListItem, Record<string, string | undefined>>({
  fetcher: (params) =>
    fetchRevisions({
      page: params.page,
      perPage: params.perPage,
      status: params.status,
    }),
  defaultFilters: { status: 'SUBMITTED' },
  defaultPerPage: 25,
});

const queueLabel = computed(() =>
  list.filters.status === 'SUBMITTED'
    ? 'Profils à valider'
    : `Révisions — ${revisionStatusInfo(list.filters.status ?? '').label}`,
);

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function openDetail(revision: RevisionListItem): void {
  void router.push({ name: 'revision-detail', params: { id: revision.id } });
}
</script>

<template>
  <div class="revisions-queue">
    <div class="revisions-queue__header">
      <h1 class="revisions-queue__title">{{ queueLabel }}</h1>
      <Select
        :model-value="list.filters.status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        placeholder="Tous les statuts"
        show-clear
        @update:model-value="(v) => list.setFilter('status', v ?? '')"
      />
    </div>

    <div class="revisions-queue__table">
      <div v-if="list.error.value" class="state-block state-block--error">
        <span class="state-block__icon state-block__icon--error">!</span>
        <div class="state-block__title">Impossible de charger les révisions</div>
        <Message severity="error" variant="simple" size="small">{{
          (list.error.value as Error)?.message ?? 'Erreur inconnue.'
        }}</Message>
        <Button label="Réessayer" size="small" @click="list.refresh()" />
      </div>

      <div v-else-if="list.loading.value" class="state-block">
        <div v-for="n in 5" :key="n" class="skeleton-row">
          <Skeleton shape="circle" size="2rem" />
          <Skeleton height="0.85rem" />
          <Skeleton width="6rem" height="0.85rem" />
        </div>
      </div>

      <div v-else-if="list.isEmpty.value" class="state-block">
        <span class="state-block__icon">✓</span>
        <div class="state-block__title">Aucun profil en attente</div>
        <p class="state-block__text">
          Les soumissions des speakers apparaîtront ici pour validation.
        </p>
      </div>

      <DataTable
        v-else
        :value="list.items.value"
        data-key="id"
        row-hover
        class="revisions-table"
        @row-click="(e) => openDetail(e.data as RevisionListItem)"
      >
        <Column header="Speaker" style="min-width: 240px">
          <template #body="{ data }: { data: RevisionListItem }">
            <div class="speaker-cell">
              <Avatar :label="initials(data.speaker.displayName)" shape="circle" />
              <span>{{ data.speaker.displayName }}</span>
            </div>
          </template>
        </Column>
        <Column header="Statut" style="min-width: 160px">
          <template #body="{ data }: { data: RevisionListItem }">
            <StatusTag
              :label="revisionStatusInfo(data.status).label"
              :family="revisionStatusInfo(data.status).family"
            />
          </template>
        </Column>
        <Column header="Soumise le" style="min-width: 140px">
          <template #body="{ data }: { data: RevisionListItem }">
            {{ data.submittedAt ? new Date(data.submittedAt).toLocaleDateString('fr-FR') : '—' }}
          </template>
        </Column>
        <Column style="width: 90px">
          <template #body="{ data }: { data: RevisionListItem }">
            <Button
              icon="pi pi-arrow-right"
              text
              rounded
              size="small"
              aria-label="Ouvrir"
              @click.stop="openDetail(data)"
            />
          </template>
        </Column>
      </DataTable>

      <Paginator
        v-if="!list.isEmpty.value && !list.loading.value"
        :rows="list.meta.value.perPage"
        :total-records="list.meta.value.total"
        :first="(list.page.value - 1) * list.meta.value.perPage"
        @page="(e) => list.setPage(e.page + 1)"
      />
    </div>
  </div>
</template>

<style scoped>
.revisions-queue__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--asb-space-4);
}

.revisions-queue__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.revisions-queue__table {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
}

:deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.speaker-cell {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-weight: 600;
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
