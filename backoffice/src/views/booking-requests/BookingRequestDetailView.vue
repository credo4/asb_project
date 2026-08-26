<script setup lang="ts">
// 3.3 Détail d'une demande.
import { computed, onMounted, ref, watchEffect } from 'vue';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import Timeline from 'primevue/timeline';
import Avatar from 'primevue/avatar';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import StatusTag from '../../components/StatusTag.vue';
import BackButton from '../../components/BackButton.vue';
import ProposedSpeakersBlock from './components/ProposedSpeakersBlock.vue';
import ClientLinkBlock from './components/ClientLinkBlock.vue';
import { useAuthStore } from '../../stores/auth';
import { useTaxonomiesStore } from '../../stores/taxonomies';
import {
  fetchBookingRequest,
  fetchBookingRequestHistory,
  updateBookingRequest,
  updateBookingRequestStatus,
  reopenBookingRequest,
  assignBookingRequest,
  createBookingRequestNote,
  deleteBookingRequestNote,
  uploadBookingRequestAttachment,
  deleteBookingRequestAttachment,
  createAttachmentDownloadLink,
  type BookingRequestDetail,
  type BookingRequestHistoryEntry,
} from '../../services/booking-requests';
import {
  bookingStatusInfo,
  priorityInfo,
  allowedNextBookingStatuses,
  TERMINAL_BOOKING_STATUSES,
  SERVICE_TYPE_LABELS,
  PRIORITY_INFO,
  BOOKING_STATUS,
} from '../../config/booking-status';
import type { ApiError } from '../../lib/api-error';

const props = defineProps<{ id: number }>();
const auth = useAuthStore();
const taxonomies = useTaxonomiesStore();
const confirm = useConfirm();
const toast = useToast();
onMounted(() => {
  void taxonomies.ensureLoaded();
});

const request = ref<BookingRequestDetail | null>(null);
const history = ref<BookingRequestHistoryEntry[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [detail, historyEntries] = await Promise.all([
      fetchBookingRequest(props.id),
      fetchBookingRequestHistory(props.id),
    ]);
    request.value = detail;
    history.value = historyEntries;
  } catch {
    loadError.value = 'Impossible de charger cette demande.';
  } finally {
    loading.value = false;
  }
}
watchEffect(() => {
  void load();
});

async function refreshHistory(): Promise<void> {
  history.value = await fetchBookingRequestHistory(props.id);
}

// --- Statut ---
const nextStatus = ref<string | null>(null);
const statusUpdating = ref(false);
const statusErrorMessage = ref<string | null>(null);
const nextStatusOptions = computed(() => {
  if (!request.value) return [];
  return allowedNextBookingStatuses(request.value.status).map((s) => ({
    value: s,
    label: bookingStatusInfo(s).label,
  }));
});
const isTerminal = computed(
  () => request.value && TERMINAL_BOOKING_STATUSES.includes(request.value.status),
);
const isSuperAdmin = computed(() => auth.user?.role === 'SUPER_ADMIN');

async function applyStatusChange(): Promise<void> {
  if (!request.value || !nextStatus.value) return;
  statusErrorMessage.value = null;
  statusUpdating.value = true;
  try {
    request.value = await updateBookingRequestStatus(request.value.id, {
      status: nextStatus.value as BookingRequestDetail['status'],
    });
    nextStatus.value = null;
    await refreshHistory();
    toast.add({ severity: 'success', summary: 'Statut mis à jour', life: 3000 });
  } catch (err) {
    statusErrorMessage.value = (err as ApiError)?.messages?.[0] ?? 'Erreur.';
  } finally {
    statusUpdating.value = false;
  }
}
function confirmStatusChange(): void {
  if (!nextStatus.value) return;
  confirm.require({
    message: `Confirmer le passage au statut « ${bookingStatusInfo(nextStatus.value).label} » ?`,
    header: 'Changement de statut',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Confirmer',
    rejectLabel: 'Annuler',
    accept: () => void applyStatusChange(),
  });
}

const reopenTarget = ref<string | null>(null);
const reopenOptions = Object.entries(BOOKING_STATUS)
  .filter(([value]) => !TERMINAL_BOOKING_STATUSES.includes(value))
  .map(([value, info]) => ({ value, label: info.label }));
async function onReopen(): Promise<void> {
  if (!request.value || !reopenTarget.value) return;
  statusUpdating.value = true;
  try {
    request.value = await reopenBookingRequest(request.value.id, {
      targetStatus: reopenTarget.value as BookingRequestDetail['status'],
    });
    reopenTarget.value = null;
    await refreshHistory();
    toast.add({ severity: 'success', summary: 'Demande rouverte', life: 4000 });
  } finally {
    statusUpdating.value = false;
  }
}

// --- Priorité ---
const priorityOptions = Object.entries(PRIORITY_INFO).map(([value, info]) => ({
  value,
  label: info.label,
}));
async function onPriorityChange(priority: string): Promise<void> {
  if (!request.value) return;
  request.value = await updateBookingRequest(request.value.id, {
    priority: priority as BookingRequestDetail['priority'],
  });
  toast.add({ severity: 'success', summary: 'Priorité mise à jour', life: 3000 });
}

// --- Assignation ---
const adminOptions = computed(() =>
  taxonomies.admins.map((a) => ({ value: a.id, label: taxonomies.adminName(a) })),
);
async function onAssign(adminId: number | null): Promise<void> {
  if (!request.value) return;
  request.value = await assignBookingRequest(request.value.id, {
    assignedAdminId: adminId,
  });
  toast.add({ severity: 'success', summary: 'Assignation mise à jour', life: 3000 });
}

// --- Notes (fil chronologique, ajout seul) ---
const newNote = ref('');
const addingNote = ref(false);
async function addNote(): Promise<void> {
  if (!request.value || !newNote.value.trim()) return;
  addingNote.value = true;
  try {
    const note = await createBookingRequestNote(request.value.id, newNote.value);
    request.value.notes.push(note);
    newNote.value = '';
    toast.add({ severity: 'success', summary: 'Note ajoutée', life: 3000 });
  } finally {
    addingNote.value = false;
  }
}
function confirmRemoveNote(noteId: number): void {
  confirm.require({
    message: 'Supprimer définitivement cette note ?',
    header: 'Supprimer la note',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    accept: () => void removeNote(noteId),
  });
}
async function removeNote(noteId: number): Promise<void> {
  if (!request.value) return;
  await deleteBookingRequestNote(request.value.id, noteId);
  request.value.notes = request.value.notes.filter((n) => n.id !== noteId);
  toast.add({ severity: 'success', summary: 'Note supprimée', life: 3000 });
}

// --- Pièces jointes ---
const uploadingAttachment = ref(false);
async function onSelectAttachment(event: FileUploadSelectEvent): Promise<void> {
  const file = (event.files as File[])[0];
  if (!file || !request.value) return;
  uploadingAttachment.value = true;
  try {
    const attachment = await uploadBookingRequestAttachment(request.value.id, file);
    request.value.attachments.push(attachment);
    toast.add({ severity: 'success', summary: 'Pièce jointe ajoutée', life: 3000 });
  } finally {
    uploadingAttachment.value = false;
  }
}
function confirmRemoveAttachment(attachmentId: number, filename: string): void {
  confirm.require({
    message: `Supprimer définitivement « ${filename} » ?`,
    header: 'Supprimer la pièce jointe',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    accept: () => void removeAttachment(attachmentId),
  });
}
async function removeAttachment(attachmentId: number): Promise<void> {
  if (!request.value) return;
  await deleteBookingRequestAttachment(request.value.id, attachmentId);
  request.value.attachments = request.value.attachments.filter((a) => a.id !== attachmentId);
  toast.add({ severity: 'success', summary: 'Pièce jointe supprimée', life: 3000 });
}
async function downloadAttachment(attachmentId: number): Promise<void> {
  if (!request.value) return;
  const { url } = await createAttachmentDownloadLink(request.value.id, attachmentId);
  window.open(url, '_blank');
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}
function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
</script>

<template>
  <div class="request-detail">
    <div v-if="loading" class="request-detail__skeleton">
      <Skeleton height="2rem" width="18rem" />
      <Skeleton height="12rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else-if="request">
      <BackButton :to="{ name: 'booking-requests-inbox' }" label="Demandes clients" />

      <div class="request-detail__header">
        <div>
          <h1 class="request-detail__title">{{ request.reference }}</h1>
          <p class="request-detail__subtitle">
            {{ request.fullName }} · {{ request.organization }}
          </p>
        </div>
        <span class="request-detail__spacer" />
        <StatusTag
          :label="priorityInfo(request.priority).label"
          :family="priorityInfo(request.priority).family"
        />
        <StatusTag
          :label="bookingStatusInfo(request.status).label"
          :family="bookingStatusInfo(request.status).family"
        />
      </div>

      <Message v-if="request.isOverdue" severity="error">
        Cette demande est en retard — aucune première réponse depuis l'échéance
        ({{ formatDateTime(request.responseDueAt) }}).
      </Message>

      <!-- Statut, assignation, priorité -->
      <section class="detail-card">
        <h2 class="detail-card__title">Traitement</h2>
        <div class="treatment-grid">
          <div class="field">
            <label>Statut</label>
            <div class="inline-control">
              <Select
                v-model="nextStatus"
                :options="nextStatusOptions"
                option-label="label"
                option-value="value"
                placeholder="Changer…"
                :disabled="nextStatusOptions.length === 0"
              />
              <Button
                label="Appliquer"
                size="small"
                :loading="statusUpdating"
                :disabled="!nextStatus"
                @click="confirmStatusChange"
              />
            </div>
            <Message v-if="statusErrorMessage" severity="error" variant="simple" size="small">{{
              statusErrorMessage
            }}</Message>
            <div v-if="isTerminal && isSuperAdmin" class="inline-control">
              <Select
                v-model="reopenTarget"
                :options="reopenOptions"
                option-label="label"
                option-value="value"
                placeholder="Rouvrir vers…"
              />
              <Button
                label="Rouvrir"
                size="small"
                severity="secondary"
                outlined
                :loading="statusUpdating"
                :disabled="!reopenTarget"
                @click="onReopen"
              />
            </div>
          </div>
          <div class="field">
            <label>Priorité</label>
            <Select
              :model-value="request.priority"
              :options="priorityOptions"
              option-label="label"
              option-value="value"
              @update:model-value="onPriorityChange"
            />
          </div>
          <div class="field">
            <label>Assignée à</label>
            <Select
              :model-value="request.assignedAdmin?.id ?? null"
              :options="adminOptions"
              option-label="label"
              option-value="value"
              show-clear
              placeholder="Non assignée"
              @update:model-value="onAssign"
            />
          </div>
        </div>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Client</h2>
        <dl class="detail-grid">
          <div><dt>Nom</dt><dd>{{ request.fullName }}</dd></div>
          <div><dt>Organisation</dt><dd>{{ request.organization }}</dd></div>
          <div><dt>Fonction</dt><dd>{{ request.jobTitle ?? '—' }}</dd></div>
          <div><dt>E-mail</dt><dd>{{ request.workEmail }}</dd></div>
          <div><dt>Téléphone</dt><dd>{{ request.phone ?? '—' }}</dd></div>
          <div><dt>Site / LinkedIn</dt><dd>{{ request.websiteOrLinkedin ?? '—' }}</dd></div>
        </dl>
      </section>

      <!-- Module Clients (ligne 5.12) -- rattachement CRM, distinct des
           données brutes ci-dessus (voir components/ClientLinkBlock.vue). -->
      <ClientLinkBlock :request="request" @updated="(updated) => (request = updated)" />

      <section class="detail-card">
        <h2 class="detail-card__title">Événement</h2>
        <dl class="detail-grid">
          <div><dt>Service</dt><dd>{{ SERVICE_TYPE_LABELS[request.serviceType] ?? request.serviceType }}</dd></div>
          <div><dt>Nom de l'événement</dt><dd>{{ request.eventName ?? '—' }}</dd></div>
          <div><dt>Date</dt><dd>{{ formatDateTime(request.eventDate) }}</dd></div>
          <div><dt>Lieu</dt><dd>{{ request.eventLocation ?? '—' }}</dd></div>
          <div><dt>Format</dt><dd>{{ request.eventFormat ?? '—' }}</dd></div>
          <div><dt>Taille de l'audience</dt><dd>{{ request.audienceSize ?? '—' }}</dd></div>
          <div><dt>Langue</dt><dd>{{ request.language ?? '—' }}</dd></div>
          <div><dt>Budget estimé</dt><dd>{{ request.estimatedBudget ?? '—' }}</dd></div>
        </dl>
        <dl class="detail-grid detail-grid--wide">
          <div><dt>Sujets principaux</dt><dd>{{ request.primaryTopics ?? '—' }}</dd></div>
          <div><dt>Objectifs</dt><dd>{{ request.goals ?? '—' }}</dd></div>
          <div><dt>Préférences speaker</dt><dd>{{ request.speakerPreferences ?? '—' }}</dd></div>
          <div><dt>Commentaires additionnels</dt><dd>{{ request.additionalComments ?? '—' }}</dd></div>
        </dl>
      </section>

      <!-- Extension matching & sollicitation de disponibilité -- pas un
           nouveau module, un bloc de plus sur cet écran déjà construit
           (voir components/ProposedSpeakersBlock.vue). -->
      <ProposedSpeakersBlock :request="request" />

      <!-- Notes internes en fil chronologique -->
      <section class="detail-card">
        <h2 class="detail-card__title">Notes internes</h2>
        <ul class="notes-thread">
          <li v-for="note in request.notes" :key="note.id" class="note-item">
            <Avatar :label="(note.author?.firstName ?? note.author?.email ?? '?')[0]" shape="circle" size="normal" />
            <div class="note-item__body">
              <div class="note-item__meta">
                <strong>{{ note.author ? `${note.author.firstName ?? ''} ${note.author.lastName ?? ''}`.trim() || note.author.email : 'Système' }}</strong>
                <span>{{ formatDateTime(note.createdAt) }}</span>
              </div>
              <p>{{ note.body }}</p>
            </div>
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              size="small"
              aria-label="Supprimer"
              @click="confirmRemoveNote(note.id)"
            />
          </li>
          <li v-if="request.notes.length === 0" class="notes-thread__empty">
            Aucune note pour l'instant.
          </li>
        </ul>
        <div class="note-form">
          <Textarea v-model="newNote" rows="2" auto-resize placeholder="Ajouter une note…" class="w-full" />
          <Button
            label="Ajouter"
            size="small"
            :loading="addingNote"
            :disabled="!newNote.trim()"
            @click="addNote"
          />
        </div>
      </section>

      <!-- Pièces jointes -->
      <section class="detail-card">
        <h2 class="detail-card__title">Pièces jointes</h2>
        <ul class="attachment-list">
          <li v-for="a in request.attachments" :key="a.id" class="attachment-item">
            <i class="pi pi-file" />
            <span class="attachment-item__name">{{ a.originalFilename }}</span>
            <span class="attachment-item__size">{{ formatBytes(a.sizeBytes) }}</span>
            <Button icon="pi pi-download" text rounded size="small" aria-label="Télécharger" @click="downloadAttachment(a.id)" />
            <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="confirmRemoveAttachment(a.id, a.originalFilename)" />
          </li>
          <li v-if="request.attachments.length === 0" class="notes-thread__empty">
            Aucune pièce jointe.
          </li>
        </ul>
        <FileUpload
          mode="basic"
          :auto="false"
          choose-label="Ajouter une pièce jointe…"
          custom-upload
          @select="onSelectAttachment"
        />
        <span v-if="uploadingAttachment" class="field__hint">Envoi en cours…</span>
      </section>

      <!-- Historique -->
      <section class="detail-card">
        <h2 class="detail-card__title">Historique</h2>
        <Timeline :value="history" class="history-timeline">
          <template #content="{ item }: { item: BookingRequestHistoryEntry }">
            <div class="history-item">
              <strong>{{ item.action }}</strong>
              <span class="history-item__meta">
                {{ item.actor ? (item.actor.firstName ?? item.actor.email) : 'Système' }} ·
                {{ formatDateTime(item.createdAt) }}
              </span>
            </div>
          </template>
        </Timeline>
        <p v-if="history.length === 0" class="detail-card__hint">Aucun historique.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.request-detail {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}


.request-detail__header {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  flex-wrap: wrap;
}

.request-detail__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.request-detail__subtitle {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.request-detail__spacer {
  flex: 1;
}

.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
}

.detail-card__title {
  margin: 0 0 var(--asb-space-4);
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.detail-card__hint {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.treatment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--asb-space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
}

.field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.field__hint {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.inline-control {
  display: flex;
  gap: var(--asb-space-2);
  flex-wrap: wrap;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--asb-space-4);
  margin: 0;
}

.detail-grid--wide {
  grid-template-columns: 1fr;
  margin-top: var(--asb-space-4);
}

.detail-grid dt {
  font-size: var(--asb-text-label);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--asb-text-muted);
  margin-bottom: var(--asb-space-1);
}

.detail-grid dd {
  margin: 0;
  color: var(--asb-text);
  white-space: pre-wrap;
}

.notes-thread {
  list-style: none;
  margin: 0 0 var(--asb-space-4);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
}

.note-item {
  display: flex;
  align-items: flex-start;
  gap: var(--asb-space-3);
}

.note-item__body {
  flex: 1;
}

.note-item__meta {
  display: flex;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.note-item p {
  margin: var(--asb-space-1) 0 0;
  font-size: var(--asb-text-sm);
  white-space: pre-wrap;
}

.notes-thread__empty {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  list-style: none;
}

.note-form {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
  align-items: flex-end;
}

.w-full {
  width: 100%;
}

.attachment-list {
  list-style: none;
  margin: 0 0 var(--asb-space-3);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
}

.attachment-item__name {
  flex: 1;
  font-weight: 600;
}

.attachment-item__size {
  color: var(--asb-text-muted);
  font-family: var(--asb-font-mono);
  font-size: 12px;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-item__meta {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}
</style>
