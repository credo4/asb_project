<script setup lang="ts">
// 1. Bloc « Speakers proposés » (prompt d'extension matching/dispo, §1).
// PAS un nouveau module : un bloc de plus sur le détail d'une demande déjà
// construit (voir BookingRequestDetailView.vue).
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Avatar from 'primevue/avatar';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import StatusTag from '../../../components/StatusTag.vue';
import FindSpeakersPanel from './FindSpeakersPanel.vue';
import RequestAvailabilityDialog from './RequestAvailabilityDialog.vue';
import { fetchSpeaker, type SpeakerDetail } from '../../../services/speakers';
import {
  fetchBookingRequestSpeakers,
  removeBookingRequestSpeaker,
  updateBookingRequestSpeakerStatus,
  reorderBookingRequestSpeakers,
  type BookingRequestSpeaker,
} from '../../../services/booking-request-speakers';
import { fetchAvailabilityRequestsForBooking, type AvailabilityRequestAdmin } from '../../../services/availability-requests';
import { createMission } from '../../../services/missions';
import { bookingRequestSpeakerStatusInfo } from '../../../config/booking-request-speaker-status';
import {
  availabilityRequestStatusInfo,
  availabilityResponseStatusInfo,
} from '../../../config/availability-status';
import type { BookingRequestDetail } from '../../../services/booking-requests';

const props = defineProps<{ request: BookingRequestDetail }>();

const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

const loading = ref(true);
const loadError = ref<string | null>(null);
const speakers = ref<BookingRequestSpeaker[]>([]);
const enrichment = ref<Record<number, Pick<SpeakerDetail, 'professionalTitle' | 'country'>>>({});
const availabilityRequests = ref<AvailabilityRequestAdmin[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [rows, requests] = await Promise.all([
      fetchBookingRequestSpeakers(props.request.id),
      fetchAvailabilityRequestsForBooking(props.request.id),
    ]);
    speakers.value = rows;
    availabilityRequests.value = requests;

    // BookingRequestSpeakerSpeakerRefDto n'expose pas professionalTitle/pays
    // (voir CLAUDE.md/commit -- volontairement pas de modification de l'API
    // pour cette extension) : enrichi ici via GET /admin/speakers/:id déjà
    // existant (Phase 2), un appel par speaker attaché -- liste courte en
    // pratique (rarement plus de quelques speakers par demande).
    const details = await Promise.all(
      rows.map((r) => fetchSpeaker(r.speaker.id).catch(() => null)),
    );
    const map: Record<number, Pick<SpeakerDetail, 'professionalTitle' | 'country'>> = {};
    rows.forEach((r, i) => {
      const detail = details[i];
      if (detail) {
        map[r.speaker.id] = { professionalTitle: detail.professionalTitle, country: detail.country };
      }
    });
    enrichment.value = map;
  } catch {
    loadError.value = 'Impossible de charger les speakers proposés.';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const attachedSpeakerIds = computed(() => speakers.value.map((s) => s.speaker.id));

// Dernière sollicitation connue par speaker (triées par sentAt desc côté
// API -- la première trouvée est la plus récente).
function lastAvailabilityRequestFor(speakerId: number): AvailabilityRequestAdmin | null {
  return availabilityRequests.value.find((a) => a.speakerId === speakerId) ?? null;
}

const CAN_REQUEST_AVAILABILITY = ['SHORTLISTED', 'SPEAKER_NEEDS_INFO'];
function canRequestAvailability(speaker: BookingRequestSpeaker): boolean {
  return CAN_REQUEST_AVAILABILITY.includes(speaker.status);
}

// §1 de l'extension Missions -- "le maillon manquant" : visible UNIQUEMENT
// quand la demande est CONFIRMED/CONTRACT_IN_PREPARATION ET que CE speaker
// est retenu (SELECTED). Le bouton vit sur SA ligne : "quel speaker" est
// donc déjà sans ambiguïté, pas besoin d'un sélecteur séparé.
const REQUEST_STATUS_ALLOWS_MISSION = ['CONFIRMED', 'CONTRACT_IN_PREPARATION'];
function canCreateMission(speaker: BookingRequestSpeaker): boolean {
  return (
    REQUEST_STATUS_ALLOWS_MISSION.includes(props.request.status) &&
    speaker.status === 'SELECTED'
  );
}
const creatingMissionFor = ref<number | null>(null);
function confirmCreateMission(speaker: BookingRequestSpeaker): void {
  confirm.require({
    message: `Créer une mission pour ${speaker.speaker.displayName} sur la demande ${props.request.reference} ?`,
    header: 'Créer une mission',
    icon: 'pi pi-briefcase',
    acceptLabel: 'Créer',
    rejectLabel: 'Annuler',
    accept: () => void doCreateMission(speaker),
  });
}
async function doCreateMission(speaker: BookingRequestSpeaker): Promise<void> {
  creatingMissionFor.value = speaker.id;
  try {
    const mission = await createMission(props.request.id, {
      speakerId: speaker.speaker.id,
    });
    toast.add({
      severity: 'success',
      summary: 'Mission créée',
      detail: mission.reference,
      life: 3000,
    });
    await router.push({ name: 'mission-detail', params: { id: mission.id } });
  } finally {
    creatingMissionFor.value = null;
  }
}

const nextStatusDrafts = ref<Record<number, string | null>>({});
function allowedNext(status: string): string[] {
  const map: Record<string, string[]> = {
    SHORTLISTED: ['AVAILABILITY_REQUESTED', 'WITHDRAWN'],
    AVAILABILITY_REQUESTED: [
      'SPEAKER_AVAILABLE',
      'SPEAKER_AVAILABLE_WITH_CONDITIONS',
      'SPEAKER_UNAVAILABLE',
      'SPEAKER_NEEDS_INFO',
      'WITHDRAWN',
    ],
    SPEAKER_NEEDS_INFO: ['AVAILABILITY_REQUESTED', 'WITHDRAWN'],
    SPEAKER_AVAILABLE: ['PROPOSED_TO_CLIENT', 'WITHDRAWN'],
    SPEAKER_AVAILABLE_WITH_CONDITIONS: ['PROPOSED_TO_CLIENT', 'WITHDRAWN'],
    SPEAKER_UNAVAILABLE: ['WITHDRAWN'],
    PROPOSED_TO_CLIENT: ['CLIENT_DECLINED', 'SELECTED', 'WITHDRAWN'],
    CLIENT_DECLINED: [],
    SELECTED: [],
    WITHDRAWN: [],
  };
  return map[status] ?? [];
}
function statusOptionsFor(speaker: BookingRequestSpeaker) {
  return allowedNext(speaker.status).map((s) => ({
    value: s,
    label: bookingRequestSpeakerStatusInfo(s).label,
  }));
}

const statusUpdating = ref<number | null>(null);
async function applyStatus(speaker: BookingRequestSpeaker): Promise<void> {
  const next = nextStatusDrafts.value[speaker.id];
  if (!next) return;
  statusUpdating.value = speaker.id;
  try {
    await updateBookingRequestSpeakerStatus(props.request.id, speaker.speaker.id, {
      status: next as BookingRequestSpeaker['status'],
    });
    nextStatusDrafts.value[speaker.id] = null;
    await load();
    toast.add({ severity: 'success', summary: 'Statut mis à jour', life: 3000 });
  } finally {
    statusUpdating.value = null;
  }
}

function confirmRemove(speaker: BookingRequestSpeaker): void {
  confirm.require({
    message: `Retirer ${speaker.speaker.displayName} de la sélection de cette demande ?`,
    header: 'Retirer le speaker',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Retirer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    accept: () => void remove(speaker),
  });
}
async function remove(speaker: BookingRequestSpeaker): Promise<void> {
  await removeBookingRequestSpeaker(props.request.id, speaker.speaker.id);
  await load();
  toast.add({ severity: 'success', summary: 'Speaker retiré', life: 3000 });
}

async function move(speaker: BookingRequestSpeaker, direction: -1 | 1): Promise<void> {
  const ordered = [...speakers.value].sort((a, b) => a.displayOrder - b.displayOrder);
  const index = ordered.findIndex((s) => s.id === speaker.id);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= ordered.length) return;
  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
  await reorderBookingRequestSpeakers(props.request.id, {
    orderedSpeakerIds: ordered.map((s) => s.speaker.id),
  });
  await load();
}

const findPanelOpen = ref(false);
const availabilityDialogOpen = ref(false);
const availabilityDialogSpeaker = ref<BookingRequestSpeaker | null>(null);
function openAvailabilityDialog(speaker: BookingRequestSpeaker): void {
  availabilityDialogSpeaker.value = speaker;
  availabilityDialogOpen.value = true;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}
</script>

<template>
  <section class="detail-card">
    <div class="proposed-speakers__header">
      <h2 class="detail-card__title">Speakers proposés</h2>
      <Button
        label="Trouver des speakers…"
        icon="pi pi-search"
        size="small"
        @click="findPanelOpen = true"
      />
    </div>

    <div v-if="loading" class="proposed-speakers__skeleton">
      <Skeleton v-for="n in 2" :key="n" height="4rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <div v-else-if="speakers.length === 0" class="state-block">
      <span class="state-block__icon">＋</span>
      <div class="state-block__title">Aucun speaker proposé pour l'instant</div>
      <p class="state-block__text">Trouvez des candidats correspondant à cette demande.</p>
      <Button label="Trouver des speakers…" size="small" @click="findPanelOpen = true" />
    </div>

    <ul v-else class="proposed-speakers__list">
      <li
        v-for="speaker in [...speakers].sort((a, b) => a.displayOrder - b.displayOrder)"
        :key="speaker.id"
        class="proposed-speaker"
      >
        <div class="proposed-speaker__main">
          <div class="proposed-speaker__order">
            <button type="button" class="order-btn" aria-label="Monter" @click="move(speaker, -1)">
              <i class="pi pi-chevron-up" />
            </button>
            <button type="button" class="order-btn" aria-label="Descendre" @click="move(speaker, 1)">
              <i class="pi pi-chevron-down" />
            </button>
          </div>
          <Avatar
            v-if="speaker.speaker.profilePhotoUrl"
            :image="speaker.speaker.profilePhotoUrl"
            shape="circle"
          />
          <Avatar v-else :label="initials(speaker.speaker.displayName)" shape="circle" />
          <div class="proposed-speaker__identity">
            <span class="proposed-speaker__name">{{ speaker.speaker.displayName }}</span>
            <span class="proposed-speaker__meta">
              <template v-if="enrichment[speaker.speaker.id]?.professionalTitle">{{
                enrichment[speaker.speaker.id]?.professionalTitle
              }}</template>
              <template v-if="enrichment[speaker.speaker.id]?.country">
                · {{ enrichment[speaker.speaker.id]?.country?.name }}</template
              >
            </span>
          </div>
          <span class="proposed-speaker__spacer" />
          <StatusTag
            :label="bookingRequestSpeakerStatusInfo(speaker.status).label"
            :family="bookingRequestSpeakerStatusInfo(speaker.status).family"
          />
        </div>

        <div class="proposed-speaker__actions">
          <Select
            v-model="nextStatusDrafts[speaker.id]"
            :options="statusOptionsFor(speaker)"
            option-label="label"
            option-value="value"
            placeholder="Changer le statut…"
            :disabled="statusOptionsFor(speaker).length === 0"
            size="small"
          />
          <Button
            label="Appliquer"
            size="small"
            text
            :loading="statusUpdating === speaker.id"
            :disabled="!nextStatusDrafts[speaker.id]"
            @click="applyStatus(speaker)"
          />
          <Button
            v-if="canRequestAvailability(speaker)"
            label="Demander la disponibilité"
            icon="pi pi-calendar"
            size="small"
            severity="secondary"
            outlined
            @click="openAvailabilityDialog(speaker)"
          />
          <Button
            v-if="canCreateMission(speaker)"
            label="Créer une mission"
            icon="pi pi-briefcase"
            size="small"
            :loading="creatingMissionFor === speaker.id"
            @click="confirmCreateMission(speaker)"
          />
          <Button
            label="Retirer"
            icon="pi pi-trash"
            size="small"
            text
            severity="danger"
            @click="confirmRemove(speaker)"
          />
        </div>

        <div v-if="lastAvailabilityRequestFor(speaker.speaker.id)" class="availability-state">
          <StatusTag
            :label="availabilityRequestStatusInfo(lastAvailabilityRequestFor(speaker.speaker.id)!.status).label"
            :family="availabilityRequestStatusInfo(lastAvailabilityRequestFor(speaker.speaker.id)!.status).family"
          />
          <span>
            Envoyée le {{ formatDateTime(lastAvailabilityRequestFor(speaker.speaker.id)!.sentAt) }}
            · réponse attendue avant
            {{ formatDateTime(lastAvailabilityRequestFor(speaker.speaker.id)!.respondDueAt) }}
          </span>
          <template v-if="lastAvailabilityRequestFor(speaker.speaker.id)!.responseStatus">
            <StatusTag
              :label="availabilityResponseStatusInfo(lastAvailabilityRequestFor(speaker.speaker.id)!.responseStatus!).label"
              :family="availabilityResponseStatusInfo(lastAvailabilityRequestFor(speaker.speaker.id)!.responseStatus!).family"
            />
            <span v-if="lastAvailabilityRequestFor(speaker.speaker.id)!.speakerPrivateComment" class="availability-state__comment"
              >« {{ lastAvailabilityRequestFor(speaker.speaker.id)!.speakerPrivateComment }} »</span
            >
          </template>
        </div>
      </li>
    </ul>

    <FindSpeakersPanel
      v-model:visible="findPanelOpen"
      :booking-request-id="request.id"
      :attached-speaker-ids="attachedSpeakerIds"
      @added="load"
    />

    <RequestAvailabilityDialog
      v-if="availabilityDialogSpeaker"
      v-model:visible="availabilityDialogOpen"
      :request="request"
      :speaker="availabilityDialogSpeaker"
      @sent="load"
    />
  </section>
</template>

<style scoped>
.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
}

.detail-card__title {
  margin: 0;
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.proposed-speakers__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--asb-space-4);
}

.proposed-speakers__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
}

.proposed-speakers__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
}

.proposed-speaker {
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
}

.proposed-speaker__main {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
}

.proposed-speaker__order {
  display: flex;
  flex-direction: column;
}

.order-btn {
  width: 20px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--asb-text-muted);
  cursor: pointer;
  font-size: 11px;
}

.order-btn:hover {
  color: var(--asb-text);
}

.proposed-speaker__identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.proposed-speaker__name {
  font-weight: 600;
  color: var(--asb-text);
}

.proposed-speaker__meta {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.proposed-speaker__spacer {
  flex: 1;
}

.proposed-speaker__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--asb-space-2);
  padding-left: calc(20px + var(--asb-space-3) + 32px + var(--asb-space-3));
}

.availability-state {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  padding-left: calc(20px + var(--asb-space-3) + 32px + var(--asb-space-3));
}

.availability-state__comment {
  font-style: italic;
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-8);
  text-align: center;
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

.state-block__text {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}
</style>
