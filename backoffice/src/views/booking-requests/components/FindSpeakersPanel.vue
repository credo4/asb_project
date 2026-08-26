<script setup lang="ts">
// 2. Panneau « Trouver des speakers » (prompt d'extension matching/dispo,
// §2). PAS branché sur useApiList : l'endpoint matching-candidates n'est
// délibérément PAS paginé ({candidates: [...]}, pas {data, meta} -- voir
// services/matching.ts) -- state local ici, mêmes conventions visuelles
// (squelette, vide) que le reste de l'app sans forcer un contrat qui ne
// correspond pas à la réalité de cet endpoint.
import { computed, onMounted, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';
import DatePicker from 'primevue/datepicker';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import StatusTag from '../../../components/StatusTag.vue';
import { useTaxonomiesStore } from '../../../stores/taxonomies';
import {
  fetchMatchingCandidates,
  type MatchingCandidate,
  type MatchingCandidatesResponse,
  type MatchingCriteria,
} from '../../../services/matching';
import { addBookingRequestSpeaker } from '../../../services/booking-request-speakers';
import { FEE_TIER_LABELS } from '../../../config/speaker-status';
import { matchingAvailabilityStatusInfo } from '../../../config/availability-status';

const props = defineProps<{
  visible: boolean;
  bookingRequestId: number;
  attachedSpeakerIds: number[];
}>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  added: [];
}>();

const taxonomies = useTaxonomiesStore();
const toast = useToast();
onMounted(() => {
  void taxonomies.ensureLoaded();
});

const loading = ref(false);
const error = ref<string | null>(null);
const candidates = ref<MatchingCandidate[]>([]);
const requestContext = ref<MatchingCandidatesResponse['requestContext'] | null>(null);

// Critères modifiables -- initialisés depuis `criteriaUsed` renvoyé par le
// premier appel (sans filtre) : c'est ce que l'API a déjà résolu depuis la
// demande (seul eventDate est structurellement pré-remplissable -- voir
// query-matching-candidates.dto.ts côté API, les autres restent à la
// discrétion de l'admin, jamais devinés depuis du texte libre).
const filters = ref<Omit<MatchingCriteria, 'eventDate' | 'eventEndDate'>>({});
// DatePicker (PrimeVue) travaille en `Date`, l'API en chaîne "YYYY-MM-DD" --
// deux refs séparées, converties au moment de l'appel.
const eventDate = ref<Date | null>(null);
const eventEndDate = ref<Date | null>(null);
let initialized = false;

function toIsoDate(d: Date | null): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}
function fromIsoDate(s: string | undefined): Date | null {
  return s ? new Date(s) : null;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetchMatchingCandidates(props.bookingRequestId, {
      ...filters.value,
      eventDate: toIsoDate(eventDate.value),
      eventEndDate: toIsoDate(eventEndDate.value),
    });
    candidates.value = response.candidates;
    requestContext.value = response.requestContext;
    if (!initialized) {
      filters.value = {
        pillar: response.criteriaUsed.pillar ?? undefined,
        theme: response.criteriaUsed.theme ?? undefined,
        format: response.criteriaUsed.format ?? undefined,
        language: response.criteriaUsed.language ?? undefined,
        country: response.criteriaUsed.country ?? undefined,
        isVirtual: response.criteriaUsed.isVirtual,
        includeUnpublished: response.criteriaUsed.includeUnpublished,
      };
      eventDate.value = fromIsoDate(response.criteriaUsed.eventDate);
      eventEndDate.value = fromIsoDate(response.criteriaUsed.eventEndDate);
      initialized = true;
    }
  } catch {
    error.value = 'Impossible de charger les candidats.';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      initialized = false;
      filters.value = {};
      eventDate.value = null;
      eventEndDate.value = null;
      void load();
    }
  },
);

function applyFilters(): void {
  void load();
}

const pillarOptions = computed(() =>
  taxonomies.pillars.map((p) => ({ value: p.slug, label: p.name })),
);
const themeOptions = computed(() =>
  taxonomies.themes.map((t) => ({ value: t.slug, label: t.name })),
);
const formatOptions = computed(() =>
  taxonomies.formats.map((f) => ({ value: f.slug, label: f.name })),
);
const languageOptions = computed(() =>
  taxonomies.languages.map((l) => ({ value: l.code, label: l.name })),
);
const countryOptions = computed(() =>
  taxonomies.countries.map((c) => ({ value: c.iso2, label: c.name })),
);

// Sélection multiple + ajout groupé.
const selected = ref<Set<number>>(new Set());
function toggleSelected(speakerId: number): void {
  if (selected.value.has(speakerId)) {
    selected.value.delete(speakerId);
  } else {
    selected.value.add(speakerId);
  }
}
const isAttached = (speakerId: number) => props.attachedSpeakerIds.includes(speakerId);

const adding = ref(false);
async function addSelected(): Promise<void> {
  const ids = [...selected.value].filter((id) => !isAttached(id));
  if (ids.length === 0) return;
  adding.value = true;
  try {
    const results = await Promise.allSettled(
      ids.map((speakerId) =>
        addBookingRequestSpeaker(props.bookingRequestId, { speakerId }),
      ),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (succeeded > 0) {
      selected.value.clear();
      emit('added');
      toast.add({
        severity: failed > 0 ? 'warn' : 'success',
        summary:
          succeeded > 1
            ? `${succeeded} speakers ajoutés à la sélection`
            : 'Speaker ajouté à la sélection',
        detail: failed > 0 ? `${failed} échec(s) — déjà ajoutés entre-temps ?` : undefined,
        life: 4000,
      });
    } else {
      toast.add({ severity: 'error', summary: "Échec de l'ajout", life: 4000 });
    }
  } finally {
    adding.value = false;
  }
}

function close(): void {
  emit('update:visible', false);
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
  <Dialog
    :visible="visible"
    modal
    header="Trouver des speakers"
    style="width: 90vw; max-width: 1100px"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="find-panel">
      <Message severity="info" :closable="false" class="find-panel__intro">
        Les critères ci-dessous viennent de la demande quand c'est possible
        (seule la date est déduite automatiquement) — modifiez-les librement
        pour élargir ou affiner la recherche.
      </Message>

      <div v-if="requestContext" class="find-panel__context">
        <span class="find-panel__context-title">Pour référence, tel que déclaré dans la demande :</span>
        <span v-if="requestContext.eventLocation">Lieu : {{ requestContext.eventLocation }}</span>
        <span v-if="requestContext.eventFormat">Format : {{ requestContext.eventFormat }}</span>
        <span v-if="requestContext.language">Langue : {{ requestContext.language }}</span>
        <span v-if="requestContext.audienceSize">Audience : {{ requestContext.audienceSize }}</span>
        <span v-if="requestContext.estimatedBudget">Budget client : {{ requestContext.estimatedBudget }}</span>
      </div>

      <div class="find-panel__filters">
        <div class="field">
          <label>Pilier</label>
          <Select
            v-model="filters.pillar"
            :options="pillarOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
          />
        </div>
        <div class="field">
          <label>Thème</label>
          <Select
            v-model="filters.theme"
            :options="themeOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
          />
        </div>
        <div class="field">
          <label>Format</label>
          <Select
            v-model="filters.format"
            :options="formatOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Tous"
          />
        </div>
        <div class="field">
          <label>Langue</label>
          <Select
            v-model="filters.language"
            :options="languageOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="Toutes"
          />
        </div>
        <div class="field">
          <label>Pays de l'événement</label>
          <Select
            v-model="filters.country"
            :options="countryOptions"
            option-label="label"
            option-value="value"
            show-clear
            filter
            placeholder="Tous"
          />
        </div>
        <div class="field">
          <label>Date</label>
          <DatePicker v-model="eventDate" date-format="yy-mm-dd" show-icon />
        </div>
        <div class="field field--inline">
          <Checkbox v-model="filters.isVirtual" binary input-id="find-virtual" />
          <label for="find-virtual">Événement virtuel</label>
        </div>
        <div class="field field--inline">
          <Checkbox v-model="filters.includeUnpublished" binary input-id="find-unpublished" />
          <label for="find-unpublished">Inclure les profils non publiés</label>
        </div>
        <Button label="Rechercher" size="small" @click="applyFilters" />
      </div>

      <div class="find-panel__results">
        <div v-if="error" class="state-block state-block--error">
          <span class="state-block__icon state-block__icon--error">!</span>
          <div class="state-block__title">{{ error }}</div>
          <Button label="Réessayer" size="small" @click="load" />
        </div>

        <div v-else-if="loading" class="candidate-grid">
          <Skeleton v-for="n in 4" :key="n" height="10rem" />
        </div>

        <div v-else-if="candidates.length === 0" class="state-block">
          <span class="state-block__icon">⌕</span>
          <div class="state-block__title">Aucun candidat pour ces critères</div>
          <p class="state-block__text">Essayez d'élargir la recherche.</p>
        </div>

        <div v-else class="candidate-grid">
          <div v-for="c in candidates" :key="c.speaker.id" class="candidate-card">
            <div class="candidate-card__header">
              <Checkbox
                :model-value="selected.has(c.speaker.id)"
                :disabled="isAttached(c.speaker.id)"
                binary
                @update:model-value="() => toggleSelected(c.speaker.id)"
              />
              <Avatar
                v-if="c.speaker.profilePhotoUrl"
                :image="c.speaker.profilePhotoUrl"
                shape="circle"
              />
              <Avatar v-else :label="initials(c.speaker.displayName)" shape="circle" />
              <div class="candidate-card__identity">
                <span class="candidate-card__name">{{ c.speaker.displayName }}</span>
                <span v-if="c.speaker.professionalTitle" class="candidate-card__title">{{
                  c.speaker.professionalTitle
                }}</span>
              </div>
              <span class="candidate-card__spacer" />
              <StatusTag
                :label="matchingAvailabilityStatusInfo(c.availability.status).label"
                :family="matchingAvailabilityStatusInfo(c.availability.status).family"
              />
            </div>

            <div class="candidate-card__meta">
              <span v-if="c.speaker.feeTierPublic">{{ FEE_TIER_LABELS[c.speaker.feeTierPublic] }}</span>
            </div>

            <div v-if="c.availability.reasons.length > 0" class="candidate-card__availability-reasons">
              <span v-for="reason in c.availability.reasons" :key="reason">{{ reason }}</span>
            </div>

            <div class="candidate-card__criteria">
              <span
                v-for="item in c.criteria.satisfied"
                :key="`ok-${item}`"
                class="criteria-pill criteria-pill--ok"
                >{{ item }}</span
              >
              <span
                v-for="item in c.criteria.unsatisfied"
                :key="`ko-${item}`"
                class="criteria-pill criteria-pill--warn"
                >{{ item }}</span
              >
            </div>

            <Button
              :label="isAttached(c.speaker.id) ? 'Déjà dans la sélection' : 'Ajouter à la sélection'"
              size="small"
              :disabled="isAttached(c.speaker.id)"
              :outlined="isAttached(c.speaker.id)"
              @click="
                () => {
                  selected.add(c.speaker.id);
                  addSelected();
                }
              "
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Fermer" text @click="close" />
      <Button
        :label="`Ajouter la sélection (${selected.size})`"
        :disabled="selected.size === 0 || adding"
        :loading="adding"
        @click="addSelected"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.find-panel {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.find-panel__intro {
  margin: 0;
}

.find-panel__context {
  display: flex;
  flex-wrap: wrap;
  gap: var(--asb-space-3);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  background: var(--asb-surface-sunken);
  padding: var(--asb-space-3);
}

.find-panel__context-title {
  font-weight: 600;
  color: var(--asb-text);
  width: 100%;
}

.find-panel__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--asb-space-3);
  padding: var(--asb-space-4);
  background: var(--asb-surface-hover);
  border: 1px solid var(--asb-border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
  min-width: 160px;
}

.field--inline {
  flex-direction: row;
  align-items: center;
  gap: var(--asb-space-2);
}

.field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--asb-space-4);
}

.candidate-card {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-4);
}

.candidate-card__header {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
}

.candidate-card__identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.candidate-card__name {
  font-weight: 600;
  color: var(--asb-text);
}

.candidate-card__title {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.candidate-card__spacer {
  flex: 1;
}

.candidate-card__meta {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.candidate-card__availability-reasons {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.candidate-card__criteria {
  display: flex;
  flex-wrap: wrap;
  gap: var(--asb-space-1);
}

.criteria-pill {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: var(--asb-radius-sm);
  border: 1px solid transparent;
}

.criteria-pill--ok {
  background: var(--asb-success-50);
  border-color: #c6dbcf;
  color: var(--asb-success-600);
}

.criteria-pill--warn {
  background: var(--asb-warning-50);
  border-color: #ebd9b8;
  color: var(--asb-warning-600);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-8);
  text-align: center;
  grid-column: 1 / -1;
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
</style>
