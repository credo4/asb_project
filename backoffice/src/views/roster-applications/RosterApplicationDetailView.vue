<script setup lang="ts">
// 4.1 Détail d'une candidature : traitement, grille d'évaluation à 9
// critères, conversion en compte speaker (confirmation explicite).
import { computed, onMounted, ref, watchEffect } from 'vue';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import Rating from 'primevue/rating';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import Dialog from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import Timeline from 'primevue/timeline';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import StatusTag from '../../components/StatusTag.vue';
import BackButton from '../../components/BackButton.vue';
import { useAuthStore } from '../../stores/auth';
import { useTaxonomiesStore } from '../../stores/taxonomies';
import {
  fetchRosterApplication,
  fetchRosterApplicationHistory,
  updateApplicationStatus,
  reopenApplication,
  assignApplication,
  requestApplicationInfo,
  rejectApplication,
  convertApplication,
  attachExistingUser,
  resendInvitation,
  upsertOwnEvaluation,
  uploadApplicationAttachment,
  deleteApplicationAttachment,
  createApplicationAttachmentDownloadLink,
  type RosterApplicationDetail,
  type RosterApplicationHistoryEntry,
} from '../../services/roster-applications';
import {
  applicationStatusInfo,
  allowedNextApplicationStatuses,
  TERMINAL_APPLICATION_STATUSES,
  REOPENABLE_APPLICATION_STATUSES,
  APPLICATION_STATUS,
  EVALUATION_CRITERIA,
} from '../../config/roster-application-status';
import type { ApiError } from '../../lib/api-error';

const props = defineProps<{ id: number }>();
const auth = useAuthStore();
const taxonomies = useTaxonomiesStore();
const confirm = useConfirm();
const toast = useToast();
onMounted(() => {
  void taxonomies.ensureLoaded();
});

const application = ref<RosterApplicationDetail | null>(null);
const history = ref<RosterApplicationHistoryEntry[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [detail, historyEntries] = await Promise.all([
      fetchRosterApplication(props.id),
      fetchRosterApplicationHistory(props.id),
    ]);
    application.value = detail;
    history.value = historyEntries;
  } catch {
    loadError.value = 'Impossible de charger cette candidature.';
  } finally {
    loading.value = false;
  }
}
watchEffect(() => {
  void load();
});
async function refreshHistory(): Promise<void> {
  history.value = await fetchRosterApplicationHistory(props.id);
}

// --- Statut générique ---
const nextStatus = ref<string | null>(null);
const statusUpdating = ref(false);
const statusErrorMessage = ref<string | null>(null);
const nextStatusOptions = computed(() => {
  if (!application.value) return [];
  return allowedNextApplicationStatuses(application.value.status).map((s) => ({
    value: s,
    label: applicationStatusInfo(s).label,
  }));
});
const isTerminal = computed(
  () => application.value && TERMINAL_APPLICATION_STATUSES.includes(application.value.status),
);
const isReopenable = computed(
  () => application.value && REOPENABLE_APPLICATION_STATUSES.includes(application.value.status),
);
const isSuperAdmin = computed(() => auth.user?.role === 'SUPER_ADMIN');

async function applyStatusChange(): Promise<void> {
  if (!application.value || !nextStatus.value) return;
  statusErrorMessage.value = null;
  statusUpdating.value = true;
  try {
    application.value = await updateApplicationStatus(application.value.id, {
      status: nextStatus.value as RosterApplicationDetail['status'],
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
    message: `Confirmer le passage au statut « ${applicationStatusInfo(nextStatus.value).label} » ?`,
    header: 'Changement de statut',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Confirmer',
    rejectLabel: 'Annuler',
    accept: () => void applyStatusChange(),
  });
}

const reopenTarget = ref<string | null>(null);
const reopenOptions = Object.entries(APPLICATION_STATUS)
  .filter(([value]) => !TERMINAL_APPLICATION_STATUSES.includes(value))
  .map(([value, info]) => ({ value, label: info.label }));
async function onReopen(): Promise<void> {
  if (!application.value || !reopenTarget.value) return;
  statusUpdating.value = true;
  try {
    application.value = await reopenApplication(application.value.id, {
      targetStatus: reopenTarget.value as RosterApplicationDetail['status'],
    });
    reopenTarget.value = null;
    await refreshHistory();
    toast.add({ severity: 'success', summary: 'Candidature rouverte', life: 3000 });
  } finally {
    statusUpdating.value = false;
  }
}

// --- Assignation ---
const adminOptions = computed(() =>
  taxonomies.admins.map((a) => ({ value: a.id, label: taxonomies.adminName(a) })),
);
async function onAssign(adminId: number | null): Promise<void> {
  if (!application.value) return;
  application.value = await assignApplication(application.value.id, {
    assignedAdminId: adminId,
  });
  toast.add({ severity: 'success', summary: 'Assignation mise à jour', life: 3000 });
}

// --- Demander des informations ---
const infoDialogOpen = ref(false);
const infoMessage = ref('');
const actionSubmitting = ref(false);
async function onRequestInfo(): Promise<void> {
  if (!application.value || !infoMessage.value.trim()) return;
  actionSubmitting.value = true;
  try {
    application.value = await requestApplicationInfo(application.value.id, {
      message: infoMessage.value,
    });
    infoDialogOpen.value = false;
    infoMessage.value = '';
    await refreshHistory();
    toast.add({ severity: 'success', summary: 'Informations demandées', life: 3000 });
  } finally {
    actionSubmitting.value = false;
  }
}

// --- Refuser ---
const rejectDialogOpen = ref(false);
const rejectReason = ref('');
const sendRejectionEmail = ref(false);
async function onReject(): Promise<void> {
  if (!application.value || !rejectReason.value.trim()) return;
  actionSubmitting.value = true;
  try {
    application.value = await rejectApplication(application.value.id, {
      rejectionReason: rejectReason.value,
      sendRejectionEmail: sendRejectionEmail.value,
    });
    rejectDialogOpen.value = false;
    rejectReason.value = '';
    sendRejectionEmail.value = false;
    await refreshHistory();
    toast.add({ severity: 'success', summary: 'Candidature refusée', life: 3000 });
  } finally {
    actionSubmitting.value = false;
  }
}

// --- Conversion (confirmation EXPLICITE) ---
const convertDialogOpen = ref(false);
const converting = ref(false);
const convertConflict = ref<{ message: string; userId: number | null } | null>(null);
async function onConvert(): Promise<void> {
  if (!application.value) return;
  converting.value = true;
  convertConflict.value = null;
  try {
    const result = await convertApplication(application.value.id);
    convertDialogOpen.value = false;
    application.value = await fetchRosterApplication(application.value.id);
    await refreshHistory();
    // `invitationSent` reflète l'envoi RÉEL (voir CLAUDE.md §10 — un échec
    // d'e-mail n'annule jamais l'opération, mais ne doit pas non plus être
    // annoncé comme un succès qu'il n'a pas été) : le compte/profil existent
    // dans tous les cas, seul le message change.
    toast.add({
      severity: result.invitationSent ? 'success' : 'warn',
      summary: 'Compte speaker créé',
      detail: result.invitationSent
        ? "L'invitation a été envoyée."
        : "L'envoi de l'invitation a échoué — utilisez « Renvoyer l'invitation » pour réessayer.",
      life: 6000,
    });
  } catch (err) {
    const message = (err as ApiError)?.messages?.[0] ?? 'Erreur lors de la conversion.';
    const match = /utilisateur #(\d+)/.exec(message);
    convertConflict.value = { message, userId: match ? Number(match[1]) : null };
  } finally {
    converting.value = false;
  }
}
async function onAttachExisting(): Promise<void> {
  if (!application.value || !convertConflict.value?.userId) return;
  converting.value = true;
  try {
    await attachExistingUser(application.value.id, { userId: convertConflict.value.userId });
    convertDialogOpen.value = false;
    convertConflict.value = null;
    application.value = await fetchRosterApplication(application.value.id);
    await refreshHistory();
    toast.add({ severity: 'success', summary: 'Compte existant rattaché', life: 4000 });
  } finally {
    converting.value = false;
  }
}
const resending = ref(false);
async function onResendInvitation(): Promise<void> {
  if (!application.value) return;
  resending.value = true;
  try {
    await resendInvitation(application.value.id);
    toast.add({ severity: 'success', summary: 'Invitation renvoyée', life: 3000 });
  } finally {
    resending.value = false;
  }
}

// --- Évaluation (mon évaluation, upsert) ---
const myEvaluation = computed(() =>
  application.value?.evaluations.find((e) => e.evaluator?.id === auth.user?.id) ?? null,
);
const evalForm = ref<Record<string, number>>({});
const evalComment = ref('');
watchEffect(() => {
  const existing = myEvaluation.value;
  const next: Record<string, number> = {};
  for (const c of EVALUATION_CRITERIA) {
    next[c.key] = existing ? (existing as unknown as Record<string, number>)[c.key] : 0;
  }
  evalForm.value = next;
  evalComment.value = existing?.comment ?? '';
});
const evalComplete = computed(() =>
  EVALUATION_CRITERIA.every((c) => (evalForm.value[c.key] ?? 0) >= 1),
);
const savingEvaluation = ref(false);
async function saveEvaluation(): Promise<void> {
  if (!application.value || !evalComplete.value) return;
  savingEvaluation.value = true;
  try {
    const body = {
      ...(Object.fromEntries(
        EVALUATION_CRITERIA.map((c) => [c.key, evalForm.value[c.key]]),
      ) as Record<string, number>),
      comment: evalComment.value || undefined,
    } as Parameters<typeof upsertOwnEvaluation>[1];
    await upsertOwnEvaluation(application.value.id, body);
    application.value = await fetchRosterApplication(application.value.id);
    toast.add({ severity: 'success', summary: 'Évaluation enregistrée', life: 3000 });
  } finally {
    savingEvaluation.value = false;
  }
}

function evaluatorName(evaluator: { firstName: string | null; lastName: string | null; email: string } | null): string {
  if (!evaluator) return 'Inconnu';
  const name = [evaluator.firstName, evaluator.lastName].filter(Boolean).join(' ');
  return name || evaluator.email;
}

// --- Pièces jointes ---
const uploadingAttachment = ref(false);
async function onSelectAttachment(event: FileUploadSelectEvent): Promise<void> {
  const file = (event.files as File[])[0];
  if (!file || !application.value) return;
  uploadingAttachment.value = true;
  try {
    const attachment = await uploadApplicationAttachment(application.value.id, file);
    application.value.attachments.push(attachment);
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
  if (!application.value) return;
  await deleteApplicationAttachment(application.value.id, attachmentId);
  application.value.attachments = application.value.attachments.filter((a) => a.id !== attachmentId);
  toast.add({ severity: 'success', summary: 'Pièce jointe supprimée', life: 3000 });
}
async function downloadAttachment(attachmentId: number): Promise<void> {
  if (!application.value) return;
  const { url } = await createApplicationAttachmentDownloadLink(application.value.id, attachmentId);
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
  <div class="app-detail">
    <div v-if="loading" class="app-detail__skeleton">
      <Skeleton height="2rem" width="18rem" />
      <Skeleton height="12rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else-if="application">
      <BackButton :to="{ name: 'roster-applications-list' }" label="Candidatures" />

      <div class="app-detail__header">
        <div>
          <h1 class="app-detail__title">{{ application.fullName }}</h1>
          <p class="app-detail__subtitle">
            {{ application.reference }} · {{ application.organization ?? '—' }}
          </p>
        </div>
        <span class="app-detail__spacer" />
        <StatusTag
          :label="applicationStatusInfo(application.status).label"
          :family="applicationStatusInfo(application.status).family"
        />
      </div>

      <Message v-if="application.hasDuplicateEmail" severity="warn">
        Cet e-mail correspond à une autre candidature déjà en base, ou à un speaker existant.
      </Message>

      <!-- Conversion -->
      <section v-if="application.status === 'CONVERTED'" class="detail-card detail-card--success">
        <h2 class="detail-card__title">Convertie en compte speaker</h2>
        <p class="app-detail__conversion-text">
          Compte #{{ application.convertedUser?.id }} ({{ application.convertedUser?.email }}) ·
          converti le {{ formatDateTime(application.convertedAt) }}
        </p>
        <div class="inline-control">
          <RouterLink
            v-if="application.convertedSpeaker"
            :to="{ name: 'speakers-detail', params: { id: application.convertedSpeaker.id } }"
          >
            <Button label="Voir la fiche speaker" icon="pi pi-user" size="small" outlined />
          </RouterLink>
          <Button
            label="Renvoyer l'invitation"
            icon="pi pi-send"
            size="small"
            severity="secondary"
            outlined
            :loading="resending"
            @click="onResendInvitation"
          />
        </div>
      </section>

      <section v-else-if="application.status === 'APPROVED'" class="detail-card detail-card--gold">
        <h2 class="detail-card__title">Conversion en compte speaker</h2>
        <p class="app-detail__conversion-text">
          Cette candidature est retenue. La conversion crée un compte utilisateur et un profil
          speaker, et envoie une invitation par e-mail au candidat.
        </p>
        <Button
          label="Convertir en compte speaker…"
          icon="pi pi-user-plus"
          @click="convertDialogOpen = true"
        />
      </section>

      <!-- Traitement -->
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
            <div class="inline-control" style="margin-top: var(--asb-space-2)">
              <Button
                v-if="!isTerminal"
                label="Demander des informations"
                icon="pi pi-comment"
                size="small"
                severity="secondary"
                outlined
                @click="infoDialogOpen = true"
              />
              <Button
                v-if="!isTerminal"
                label="Refuser"
                icon="pi pi-times"
                size="small"
                severity="danger"
                text
                @click="rejectDialogOpen = true"
              />
            </div>
            <div v-if="isTerminal && isReopenable && isSuperAdmin" class="inline-control" style="margin-top: var(--asb-space-2)">
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
            <label>Assignée à</label>
            <Select
              :model-value="application.assignedAdmin?.id ?? null"
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
        <h2 class="detail-card__title">Candidature</h2>
        <dl class="detail-grid">
          <div><dt>Fonction</dt><dd>{{ application.jobTitle ?? '—' }}</dd></div>
          <div><dt>Organisation</dt><dd>{{ application.organization ?? '—' }}</dd></div>
          <div><dt>Pays</dt><dd>{{ application.country ?? '—' }}</dd></div>
          <div><dt>E-mail</dt><dd>{{ application.workEmail }}</dd></div>
          <div><dt>Téléphone</dt><dd>{{ application.phone ?? '—' }}</dd></div>
          <div><dt>LinkedIn</dt><dd>{{ application.linkedinUrl ?? '—' }}</dd></div>
          <div><dt>Domaine d'expertise</dt><dd>{{ application.expertiseArea ?? '—' }}</dd></div>
        </dl>
        <dl class="detail-grid detail-grid--wide">
          <div><dt>Sujets clés</dt><dd>{{ application.keyTopics ?? '—' }}</dd></div>
          <div><dt>Message</dt><dd>{{ application.message ?? '—' }}</dd></div>
        </dl>
      </section>

      <!-- Évaluation -->
      <section class="detail-card">
        <h2 class="detail-card__title">
          Évaluation <span class="detail-card__score">Score agrégé : {{ application.aggregatedScore ?? 'aucune évaluation' }}</span>
        </h2>

        <h3 class="detail-card__subtitle">Mon évaluation</h3>
        <div class="evaluation-form">
          <div v-for="c in EVALUATION_CRITERIA" :key="c.key" class="evaluation-form__row">
            <span class="evaluation-form__label">{{ c.label }}</span>
            <Rating v-model="evalForm[c.key]" :cancel="false" />
          </div>
          <Textarea v-model="evalComment" rows="2" auto-resize placeholder="Commentaire (optionnel)" class="w-full" />
          <Button
            label="Enregistrer mon évaluation"
            size="small"
            :loading="savingEvaluation"
            :disabled="!evalComplete"
            @click="saveEvaluation"
          />
        </div>

        <template v-if="application.evaluations.length > 0">
          <h3 class="detail-card__subtitle">Évaluations de l'équipe</h3>
          <div class="evaluations-table">
            <DataTable :value="application.evaluations" data-key="id" scrollable>
              <Column header="Évaluateur" style="min-width: 160px">
                <template #body="{ data }">{{ evaluatorName(data.evaluator) }}</template>
              </Column>
              <Column
                v-for="c in EVALUATION_CRITERIA"
                :key="c.key"
                :header="c.label"
                :field="c.key"
                style="min-width: 90px"
              />
              <Column header="Commentaire" style="min-width: 200px">
                <template #body="{ data }">{{ data.comment ?? '—' }}</template>
              </Column>
            </DataTable>
          </div>
        </template>
      </section>

      <!-- Pièces jointes -->
      <section class="detail-card">
        <h2 class="detail-card__title">Pièces jointes</h2>
        <ul class="attachment-list">
          <li v-for="a in application.attachments" :key="a.id" class="attachment-item">
            <i class="pi pi-file" />
            <span class="attachment-item__name">{{ a.originalFilename }}</span>
            <span class="attachment-item__size">{{ formatBytes(a.sizeBytes) }}</span>
            <Button icon="pi pi-download" text rounded size="small" aria-label="Télécharger" @click="downloadAttachment(a.id)" />
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              aria-label="Supprimer"
              @click="confirmRemoveAttachment(a.id, a.originalFilename)"
            />
          </li>
          <li v-if="application.attachments.length === 0" class="detail-card__hint">
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
        <Timeline :value="history">
          <template #content="{ item }: { item: RosterApplicationHistoryEntry }">
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

    <!-- Dialog : demande d'informations -->
    <Dialog v-model:visible="infoDialogOpen" header="Demander des informations" modal style="width: 480px">
      <p class="dialog-hint">Le candidat recevra ce message par e-mail.</p>
      <label>Message *</label>
      <Textarea v-model="infoMessage" rows="4" auto-resize class="w-full" />
      <template #footer>
        <Button label="Annuler" text @click="infoDialogOpen = false" />
        <Button
          label="Envoyer"
          :loading="actionSubmitting"
          :disabled="!infoMessage.trim()"
          @click="onRequestInfo"
        />
      </template>
    </Dialog>

    <!-- Dialog : refus -->
    <Dialog v-model:visible="rejectDialogOpen" header="Refuser la candidature" modal style="width: 480px">
      <label>Motif (usage interne) *</label>
      <Textarea v-model="rejectReason" rows="3" auto-resize class="w-full" />
      <div class="inline-control" style="margin-top: var(--asb-space-3)">
        <Checkbox v-model="sendRejectionEmail" binary input-id="send-rejection-email" />
        <label for="send-rejection-email">Envoyer un e-mail de refus au candidat</label>
      </div>
      <template #footer>
        <Button label="Annuler" text @click="rejectDialogOpen = false" />
        <Button
          label="Refuser"
          severity="danger"
          :loading="actionSubmitting"
          :disabled="!rejectReason.trim()"
          @click="onReject"
        />
      </template>
    </Dialog>

    <!-- Dialog : conversion, confirmation EXPLICITE -->
    <Dialog v-model:visible="convertDialogOpen" header="Convertir en compte speaker" modal style="width: 520px">
      <Message severity="warn" :closable="false">
        Cette action va <strong>créer un compte utilisateur</strong> pour
        {{ application?.workEmail }} et un profil speaker en brouillon, puis
        <strong>envoyer une invitation par e-mail</strong> au candidat pour qu'il définisse son
        mot de passe. Cette action ne peut pas être annulée.
      </Message>

      <div v-if="convertConflict" class="convert-conflict">
        <Message severity="error" :closable="false">{{ convertConflict.message }}</Message>
        <div v-if="convertConflict.userId" class="inline-control">
          <span>Rattacher au compte #{{ convertConflict.userId }} :</span>
          <Button
            label="Rattacher ce compte existant"
            size="small"
            :loading="converting"
            @click="onAttachExisting"
          />
        </div>
        <div v-else class="field">
          <label>Ou rattacher manuellement à un utilisateur existant (id)</label>
          <InputNumber v-model="convertConflict.userId" />
        </div>
      </div>

      <template #footer>
        <Button label="Annuler" text @click="convertDialogOpen = false; convertConflict = null" />
        <Button
          label="Confirmer la conversion"
          :loading="converting"
          @click="onConvert"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.app-detail {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.app-detail__header {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  flex-wrap: wrap;
}

.app-detail__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.app-detail__subtitle {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.app-detail__spacer {
  flex: 1;
}

.app-detail__conversion-text {
  margin: 0 0 var(--asb-space-3);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
}

.detail-card--gold {
  border-color: var(--asb-gold-300);
  background: var(--asb-gold-50);
}

.detail-card--success {
  border-color: #c6dbcf;
  background: var(--asb-success-50);
}

.detail-card__title {
  margin: 0 0 var(--asb-space-4);
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
}

.detail-card__score {
  font-size: var(--asb-text-sm);
  font-weight: 500;
  color: var(--asb-text-muted);
}

.detail-card__subtitle {
  margin: var(--asb-space-4) 0 var(--asb-space-2);
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}

.detail-card__hint {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  list-style: none;
}

.treatment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
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
  align-items: center;
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

.evaluation-form {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
  align-items: flex-start;
}

.evaluation-form__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--asb-space-3);
  width: 100%;
  max-width: 420px;
}

.evaluation-form__label {
  font-size: var(--asb-text-sm);
  color: var(--asb-text);
}

.evaluations-table {
  border: 1px solid var(--asb-border);
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

.dialog-hint {
  margin: 0 0 var(--asb-space-3);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.convert-conflict {
  margin-top: var(--asb-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
}

label {
  display: block;
  font-size: var(--asb-text-sm);
  font-weight: 600;
  margin-bottom: var(--asb-space-1);
}
</style>
