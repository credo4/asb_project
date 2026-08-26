<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DataTable, { type DataTableSortEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Popover from 'primevue/popover';
import Paginator from 'primevue/paginator';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import StatusTag from '../../components/StatusTag.vue';
import { useApiList } from '../../composables/useApiList';
import { useTaxonomiesStore } from '../../stores/taxonomies';
import { fetchSpeakers, type SpeakerListItem } from '../../services/speakers';
import { speakerStatusInfo, FEE_TIER_LABELS } from '../../config/speaker-status';

const router = useRouter();
const taxonomies = useTaxonomiesStore();
onMounted(() => {
  void taxonomies.ensureLoaded();
});

const compact = ref(localStorage.getItem('asb_speakers_compact') === '1');
function toggleCompact(): void {
  compact.value = !compact.value;
  localStorage.setItem('asb_speakers_compact', compact.value ? '1' : '0');
}

const list = useApiList<SpeakerListItem, Record<string, string | undefined>>({
  fetcher: (params) =>
    fetchSpeakers({
      page: params.page,
      perPage: params.perPage,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      search: params.search,
      pillarId: params.pillarId,
      themeId: params.themeId,
      countryId: params.countryId,
      languageId: params.languageId,
      formatId: params.formatId,
      feeTierPublic: params.feeTierPublic,
      status: params.status,
      isFeaturedHome: params.isFeaturedHome,
      isTopRequested: params.isTopRequested,
    }),
  defaultFilters: {
    search: '',
    pillarId: '',
    themeId: '',
    countryId: '',
    languageId: '',
    formatId: '',
    feeTierPublic: '',
    status: '',
    isFeaturedHome: '',
    isTopRequested: '',
  },
  defaultPerPage: 25,
  defaultSortBy: 'name',
  defaultSortOrder: 'asc',
});

const selected = ref<SpeakerListItem[]>([]);

const statusOptions = Object.entries({
  DRAFT: 'Brouillon',
  INCOMPLETE: 'Incomplet',
  PENDING_VALIDATION: 'En attente de validation',
  CHANGES_REQUESTED: 'Corrections demandées',
  APPROVED: 'Approuvé',
  PUBLISHED: 'Publié',
  UNPUBLISHED: 'Dépublié',
  SUSPENDED: 'Suspendu',
  ARCHIVED: 'Archivé',
  APPLICATION_REJECTED: 'Candidature refusée',
}).map(([value, label]) => ({ value, label }));

const feeTierOptions = Object.entries(FEE_TIER_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const pillarOptions = computed(() =>
  taxonomies.pillars.map((p) => ({ value: String(p.id), label: p.name })),
);
const themeOptions = computed(() => {
  const pillarId = list.filters.pillarId
    ? Number(list.filters.pillarId)
    : undefined;
  const source = pillarId
    ? taxonomies.themesForPillar(pillarId)
    : taxonomies.themes;
  return source.map((t) => ({ value: String(t.id), label: t.name }));
});
const countryOptions = computed(() =>
  taxonomies.countries.map((c) => ({ value: String(c.id), label: c.name })),
);
const languageOptions = computed(() =>
  taxonomies.languages.map((l) => ({ value: String(l.id), label: l.name })),
);
const formatOptions = computed(() =>
  taxonomies.formats.map((f) => ({ value: String(f.id), label: f.name })),
);

// Puces de filtres actifs, supprimables — repli "+ N filtres" au-delà de 3.
const FILTER_LABELS: Record<string, string> = {
  search: 'Recherche',
  pillarId: 'Pilier',
  themeId: 'Thème',
  countryId: 'Pays',
  languageId: 'Langue',
  formatId: 'Format',
  feeTierPublic: 'Tarif',
  status: 'Statut',
  isFeaturedHome: 'Mis en avant',
  isTopRequested: 'Très demandé',
};
function filterChipValue(key: string, value: string): string {
  if (key === 'pillarId')
    return pillarOptions.value.find((o) => o.value === value)?.label ?? value;
  if (key === 'themeId')
    return themeOptions.value.find((o) => o.value === value)?.label ?? value;
  if (key === 'countryId')
    return countryOptions.value.find((o) => o.value === value)?.label ?? value;
  if (key === 'languageId')
    return languageOptions.value.find((o) => o.value === value)?.label ?? value;
  if (key === 'formatId')
    return formatOptions.value.find((o) => o.value === value)?.label ?? value;
  if (key === 'feeTierPublic') return FEE_TIER_LABELS[value] ?? value;
  if (key === 'status') return speakerStatusInfo(value).label;
  if (key === 'isFeaturedHome' || key === 'isTopRequested') return 'Oui';
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
  list.sortBy.value = event.sortField;
  list.sortOrder.value = event.sortOrder === -1 ? 'desc' : 'asc';
  list.page.value = 1;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function openDetail(speaker: SpeakerListItem): void {
  void router.push({ name: 'speakers-detail', params: { id: speaker.id } });
}
</script>

<template>
  <div class="speakers-list">
    <div class="speakers-list__header">
      <h1 class="speakers-list__title">Speakers</h1>
      <Button
        label="Nouveau speaker"
        icon="pi pi-plus"
        @click="router.push({ name: 'speakers-new' })"
      />
    </div>

    <div class="speakers-list__toolbar">
      <InputText
        :model-value="list.filters.search"
        placeholder="Rechercher un speaker…"
        class="speakers-list__search"
        @update:model-value="(v) => list.setFilter('search', (v as string) ?? '')"
      />

      <template v-for="chip in visibleChips" :key="chip.key">
        <button
          type="button"
          class="filter-chip"
          @click="removeChip(chip.key)"
        >
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

      <span class="speakers-list__spacer" />

      <div class="density-toggle">
        <button
          type="button"
          class="density-toggle__option"
          :class="{ 'density-toggle__option--active': !compact }"
          @click="compact ? toggleCompact() : undefined"
        >
          Confortable
        </button>
        <button
          type="button"
          class="density-toggle__option"
          :class="{ 'density-toggle__option--active': compact }"
          @click="!compact ? toggleCompact() : undefined"
        >
          Compact
        </button>
      </div>
    </div>

    <Popover ref="filterPanel">
      <div class="filter-panel">
        <div class="filter-panel__field">
          <label>Pilier</label>
          <Select
            :model-value="list.filters.pillarId"
            :options="pillarOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('pillarId', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Thème</label>
          <Select
            :model-value="list.filters.themeId"
            :options="themeOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('themeId', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Pays</label>
          <Select
            :model-value="list.filters.countryId"
            :options="countryOptions"
            option-label="label"
            option-value="value"
            show-clear
            filter
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('countryId', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Langue</label>
          <Select
            :model-value="list.filters.languageId"
            :options="languageOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Toutes"
            @update:model-value="(v) => list.setFilter('languageId', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Format</label>
          <Select
            :model-value="list.filters.formatId"
            :options="formatOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('formatId', v ?? '')"
          />
        </div>
        <div class="filter-panel__field">
          <label>Niveau tarifaire</label>
          <Select
            :model-value="list.filters.feeTierPublic"
            :options="feeTierOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
            @update:model-value="(v) => list.setFilter('feeTierPublic', v ?? '')"
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
        <div class="filter-panel__field filter-panel__field--inline">
          <Checkbox
            :model-value="list.filters.isFeaturedHome === 'true'"
            binary
            input-id="filter-featured"
            @update:model-value="(v) => list.setFilter('isFeaturedHome', v ? 'true' : '')"
          />
          <label for="filter-featured">Mis en avant uniquement</label>
        </div>
        <div class="filter-panel__field filter-panel__field--inline">
          <Checkbox
            :model-value="list.filters.isTopRequested === 'true'"
            binary
            input-id="filter-top"
            @update:model-value="(v) => list.setFilter('isTopRequested', v ? 'true' : '')"
          />
          <label for="filter-top">Très demandé uniquement</label>
        </div>
        <Button
          label="Réinitialiser les filtres"
          text
          size="small"
          @click="list.resetFilters()"
        />
      </div>
    </Popover>

    <div class="speakers-list__table" :class="{ 'speakers-list__table--compact': compact }">
      <div v-if="list.error.value" class="state-block state-block--error">
        <span class="state-block__icon state-block__icon--error">!</span>
        <div class="state-block__title">Impossible de charger les speakers</div>
        <Message severity="error" variant="simple" size="small">{{
          (list.error.value as Error)?.message ?? 'Erreur inconnue.'
        }}</Message>
        <Button label="Réessayer" size="small" @click="list.refresh()" />
      </div>

      <div v-else-if="list.loading.value" class="state-block">
        <div v-for="n in 6" :key="n" class="skeleton-row">
          <Skeleton shape="circle" size="2rem" />
          <Skeleton height="0.85rem" />
          <Skeleton width="4rem" height="0.85rem" />
        </div>
      </div>

      <div v-else-if="list.isEmptyBecauseFiltered.value" class="state-block">
        <span class="state-block__icon">⌕</span>
        <div class="state-block__title">Aucun speaker ne correspond</div>
        <p class="state-block__text">
          {{ activeChips.length }} filtre(s) actif(s).
        </p>
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
        <div class="state-block__title">Aucun speaker pour l'instant</div>
        <p class="state-block__text">
          Créez le premier profil pour commencer.
        </p>
        <Button
          label="Nouveau speaker"
          size="small"
          @click="router.push({ name: 'speakers-new' })"
        />
      </div>

      <DataTable
        v-else
        v-model:selection="selected"
        :value="list.items.value"
        data-key="id"
        scrollable
        scroll-height="flex"
        sort-mode="single"
        :sort-field="list.sortBy.value"
        :sort-order="list.sortOrder.value === 'desc' ? -1 : 1"
        row-hover
        class="speakers-table"
        @sort="onSort"
        @row-click="(e) => openDetail(e.data as SpeakerListItem)"
      >
        <Column selection-mode="multiple" frozen style="width: 40px" />
        <Column field="displayName" header="Nom" sortable frozen style="min-width: 220px">
          <template #body="{ data }: { data: SpeakerListItem }">
            <div class="speaker-name-cell">
              <Avatar
                v-if="data.profilePhotoUrl"
                :image="data.profilePhotoUrl"
                shape="circle"
              />
              <Avatar v-else :label="initials(data.displayName)" shape="circle" />
              <div class="speaker-name-cell__text">
                <span class="speaker-name-cell__name">{{ data.displayName }}</span>
                <span
                  v-if="data.professionalTitle"
                  class="speaker-name-cell__title"
                  >{{ data.professionalTitle }}</span
                >
              </div>
            </div>
          </template>
        </Column>
        <Column header="Pays" style="min-width: 140px">
          <template #body="{ data }: { data: SpeakerListItem }">
            {{ data.country?.name ?? '—' }}
          </template>
        </Column>
        <Column header="Pilier" style="min-width: 160px">
          <template #body="{ data }: { data: SpeakerListItem }">
            {{ data.primaryPillar?.name ?? '—' }}
          </template>
        </Column>
        <Column header="Tarif" style="min-width: 90px">
          <template #body="{ data }: { data: SpeakerListItem }">
            {{ data.feeTierPublic ? FEE_TIER_LABELS[data.feeTierPublic] : '—' }}
          </template>
        </Column>
        <Column header="Complétion" style="min-width: 110px">
          <template #body="{ data }: { data: SpeakerListItem }">
            <span class="completion-cell">{{ data.completionScore }} %</span>
          </template>
        </Column>
        <Column field="status" header="Statut" sortable style="min-width: 170px">
          <template #body="{ data }: { data: SpeakerListItem }">
            <StatusTag
              :label="speakerStatusInfo(data.status).label"
              :family="speakerStatusInfo(data.status).family"
            />
          </template>
        </Column>
        <Column frozen align-frozen="right" style="width: 90px">
          <template #body="{ data }: { data: SpeakerListItem }">
            <div class="row-actions">
              <Button
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                aria-label="Modifier"
                @click.stop="router.push({ name: 'speakers-edit', params: { id: data.id } })"
              />
              <Button
                icon="pi pi-eye"
                text
                rounded
                size="small"
                aria-label="Voir"
                @click.stop="openDetail(data)"
              />
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
.speakers-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--asb-space-4);
}

.speakers-list__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.speakers-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-2);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-2);
  margin-bottom: 0;
}

.speakers-list__search {
  width: 230px;
}

.speakers-list__spacer {
  flex: 1;
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

.density-toggle {
  display: inline-flex;
  border: 1px solid var(--asb-border-strong);
  border-radius: var(--asb-radius-sm);
  overflow: hidden;
  font-size: var(--asb-text-sm);
  font-weight: 600;
}

.density-toggle__option {
  padding: 8px 12px;
  background: var(--asb-surface-card);
  color: var(--asb-text-muted);
  border: none;
  cursor: pointer;
}

.density-toggle__option--active {
  background: var(--asb-ink-900);
  color: #fff;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
  min-width: 240px;
  padding: var(--asb-space-2);
}

.filter-panel__field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.filter-panel__field--inline {
  flex-direction: row;
  align-items: center;
  gap: var(--asb-space-2);
}

.filter-panel__field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.speakers-list__table {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  border-top: none;
}

.speakers-list__table--compact :deep(.p-datatable-tbody > tr > td) {
  padding-top: var(--asb-space-1);
  padding-bottom: var(--asb-space-1);
}

:deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.speaker-name-cell {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
}

.speaker-name-cell__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.speaker-name-cell__name {
  font-weight: 600;
  color: var(--asb-text);
}

.speaker-name-cell__title {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completion-cell {
  font-family: var(--asb-font-mono);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.row-actions {
  display: flex;
  gap: var(--asb-space-1);
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
  padding: var(--asb-space-2) 0;
}

.skeleton-row :deep(.p-skeleton:nth-child(2)) {
  flex: 1;
}
</style>
