<script setup lang="ts">
// 3.6 Documents -- dépôt via l'endpoint existant, téléchargement en DEUX
// temps (lien signé à courte durée de vie, puis utilisation), cas du lien
// expiré traité proprement (voir services/mission-documents.ts).
import { ref } from 'vue';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import type { MissionDetail } from '../../../services/missions';
import {
  uploadMissionDocument,
  deleteMissionDocument,
  downloadMissionDocument,
  DownloadError,
  type MissionDocumentType,
} from '../../../services/mission-documents';
import { MISSION_DOCUMENT_TYPE_LABELS } from '../../../config/mission-status';

const props = defineProps<{
  missionId: number;
  documents: MissionDetail['documents'];
}>();
const emit = defineEmits<{ changed: [] }>();

const confirm = useConfirm();
const toast = useToast();

const typeOptions = Object.entries(MISSION_DOCUMENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const uploadType = ref<MissionDocumentType>('OTHER');
const uploadShared = ref(false);
const uploading = ref(false);

async function onSelectFile(event: FileUploadSelectEvent): Promise<void> {
  const file = (event.files as File[])[0];
  if (!file) return;
  uploading.value = true;
  try {
    await uploadMissionDocument(props.missionId, file, {
      type: uploadType.value,
      isSharedWithSpeaker: uploadShared.value,
    });
    emit('changed');
    toast.add({ severity: 'success', summary: 'Document déposé', life: 3000 });
  } finally {
    uploading.value = false;
  }
}

function confirmRemove(doc: MissionDetail['documents'][number]): void {
  confirm.require({
    message: `Supprimer définitivement « ${doc.originalFilename} » ?`,
    header: 'Supprimer le document',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    accept: () => void remove(doc),
  });
}
async function remove(doc: MissionDetail['documents'][number]): Promise<void> {
  await deleteMissionDocument(props.missionId, doc.id);
  emit('changed');
  toast.add({ severity: 'success', summary: 'Document supprimé', life: 3000 });
}

const downloadingId = ref<number | null>(null);
const downloadError = ref<string | null>(null);
async function download(doc: MissionDetail['documents'][number]): Promise<void> {
  downloadError.value = null;
  downloadingId.value = doc.id;
  try {
    await downloadMissionDocument(props.missionId, doc.id, doc.originalFilename);
  } catch (err) {
    downloadError.value =
      err instanceof DownloadError ? err.message : 'Le téléchargement a échoué.';
  } finally {
    downloadingId.value = null;
  }
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR');
}
</script>

<template>
  <section class="detail-card">
    <h2 class="detail-card__title">Documents</h2>

    <Message v-if="downloadError" severity="warn" :closable="false" class="download-error">{{
      downloadError
    }}</Message>

    <ul class="document-list">
      <li v-for="doc in documents" :key="doc.id" class="document-item">
        <i class="pi pi-file" />
        <div class="document-item__body">
          <div class="document-item__row">
            <span class="document-item__name">{{ doc.originalFilename }}</span>
            <span class="document-item__type">{{ MISSION_DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type }}</span>
            <span v-if="doc.isSharedWithSpeaker" class="document-item__shared"
              ><i class="pi pi-eye" /> Partagé avec le speaker</span
            >
          </div>
          <span class="document-item__meta"
            >{{ doc.uploadedByEmail ?? '—' }} · {{ formatDateTime(doc.createdAt) }} ·
            {{ formatBytes(doc.sizeBytes) }}</span
          >
        </div>
        <Button
          icon="pi pi-download"
          text
          rounded
          size="small"
          aria-label="Télécharger"
          :loading="downloadingId === doc.id"
          @click="download(doc)"
        />
        <Button
          icon="pi pi-trash"
          text
          rounded
          size="small"
          severity="danger"
          aria-label="Supprimer"
          @click="confirmRemove(doc)"
        />
      </li>
      <li v-if="documents.length === 0" class="detail-card__hint">Aucun document.</li>
    </ul>

    <div class="upload-row">
      <Select
        v-model="uploadType"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        size="small"
      />
      <div class="upload-row__shared">
        <Checkbox v-model="uploadShared" binary input-id="doc-shared" />
        <label for="doc-shared">Partagé avec le speaker</label>
      </div>
      <FileUpload
        mode="basic"
        :auto="false"
        choose-label="Déposer un document…"
        custom-upload
        @select="onSelectFile"
      />
      <span v-if="uploading" class="field__hint">Envoi en cours…</span>
    </div>
  </section>
</template>

<style scoped>
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
  list-style: none;
}

.download-error {
  margin: 0 0 var(--asb-space-3);
}

.document-list {
  list-style: none;
  margin: 0 0 var(--asb-space-4);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
}

.document-item {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  padding: var(--asb-space-2);
  border-bottom: 1px solid var(--asb-border);
}

.document-item__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.document-item__row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  flex-wrap: wrap;
}

.document-item__name {
  font-weight: 600;
  font-size: var(--asb-text-sm);
  color: var(--asb-text);
}

.document-item__type {
  font-size: 12px;
  color: var(--asb-gold-700);
  background: var(--asb-gold-50);
  border: 1px solid var(--asb-gold-300);
  border-radius: var(--asb-radius-sm);
  padding: 1px 6px;
}

.document-item__shared {
  font-size: 12px;
  color: var(--asb-success-600);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.document-item__meta {
  font-size: 12px;
  color: var(--asb-text-muted);
}

.upload-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  flex-wrap: wrap;
}

.upload-row__shared {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
}

.field__hint {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}
</style>
