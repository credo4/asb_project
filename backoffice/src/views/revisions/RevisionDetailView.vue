<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import StatusTag from '../../components/StatusTag.vue';
import BackButton from '../../components/BackButton.vue';
import RevisionComparisonGrid from './components/RevisionComparisonGrid.vue';
import {
  fetchRevision,
  approveRevision,
  requestRevisionChanges,
  rejectRevision,
  type RevisionDetail,
} from '../../services/speaker-revisions';
import { revisionStatusInfo } from '../../config/revision-status';

const props = defineProps<{ id: number }>();
const router = useRouter();
const toast = useToast();

const revision = ref<RevisionDetail | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const submitting = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    revision.value = await fetchRevision(props.id);
  } catch {
    loadError.value = 'Impossible de charger cette révision.';
  } finally {
    loading.value = false;
  }
}
watchEffect(() => {
  void load();
});

async function onApprove(): Promise<void> {
  submitting.value = true;
  try {
    revision.value = await approveRevision(props.id);
    toast.add({ severity: 'success', summary: 'Profil approuvé', life: 4000 });
    await router.push({ name: 'revisions-queue' });
  } finally {
    submitting.value = false;
  }
}

const changesDialogOpen = ref(false);
const changesComment = ref('');
async function onRequestChanges(): Promise<void> {
  if (!changesComment.value.trim()) return;
  submitting.value = true;
  try {
    revision.value = await requestRevisionChanges(props.id, {
      reviewerComment: changesComment.value,
    });
    changesDialogOpen.value = false;
    toast.add({ severity: 'success', summary: 'Corrections demandées', life: 4000 });
    await router.push({ name: 'revisions-queue' });
  } finally {
    submitting.value = false;
  }
}

const rejectDialogOpen = ref(false);
const rejectComment = ref('');
async function onReject(): Promise<void> {
  submitting.value = true;
  try {
    revision.value = await rejectRevision(props.id, {
      reviewerComment: rejectComment.value || undefined,
    });
    rejectDialogOpen.value = false;
    toast.add({ severity: 'success', summary: 'Révision refusée', life: 4000 });
    await router.push({ name: 'revisions-queue' });
  } finally {
    submitting.value = false;
  }
}

const isPending = (status: string) => status === 'SUBMITTED';
</script>

<template>
  <div class="revision-detail">
    <div v-if="loading" class="revision-detail__skeleton">
      <Skeleton height="2rem" width="18rem" />
      <Skeleton height="16rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else-if="revision">
      <BackButton :to="{ name: 'revisions-queue' }" label="Profils à valider" />

      <div class="revision-detail__header">
        <div>
          <h1 class="revision-detail__title">{{ revision.speaker.displayName }}</h1>
          <RouterLink
            :to="{ name: 'speakers-detail', params: { id: revision.speaker.id } }"
            class="revision-detail__profile-link"
            >Voir la fiche publiée</RouterLink
          >
        </div>
        <span class="revision-detail__spacer" />
        <StatusTag
          :label="revisionStatusInfo(revision.status).label"
          :family="revisionStatusInfo(revision.status).family"
        />
      </div>

      <Message v-if="revision.reviewerComment" severity="warn" class="reviewer-comment">
        <strong>Commentaire du dernier examen :</strong> {{ revision.reviewerComment }}
      </Message>

      <section class="detail-card">
        <h2 class="detail-card__title">Comparaison avant / après</h2>
        <RevisionComparisonGrid :diff="revision.diff" />
      </section>

      <div v-if="isPending(revision.status)" class="revision-detail__actions">
        <Button
          label="Approuver"
          icon="pi pi-check"
          :loading="submitting"
          @click="onApprove"
        />
        <Button
          label="Demander une correction"
          icon="pi pi-comment"
          severity="secondary"
          outlined
          @click="changesDialogOpen = true"
        />
        <Button
          label="Refuser"
          icon="pi pi-times"
          severity="danger"
          text
          @click="rejectDialogOpen = true"
        />
      </div>
      <Message v-else severity="info"
        >Cette révision n'est plus en attente d'examen.</Message
      >
    </template>

    <Dialog v-model:visible="changesDialogOpen" header="Demander une correction" modal style="width: 480px">
      <p class="dialog-hint">
        Le speaker recevra votre commentaire et pourra soumettre une nouvelle version.
      </p>
      <label for="changes-comment">Commentaire *</label>
      <Textarea id="changes-comment" v-model="changesComment" rows="4" auto-resize class="w-full" />
      <template #footer>
        <Button label="Annuler" text @click="changesDialogOpen = false" />
        <Button
          label="Envoyer la demande"
          :loading="submitting"
          :disabled="!changesComment.trim()"
          @click="onRequestChanges"
        />
      </template>
    </Dialog>

    <Dialog v-model:visible="rejectDialogOpen" header="Refuser la révision" modal style="width: 480px">
      <label for="reject-comment">Motif (optionnel)</label>
      <Textarea id="reject-comment" v-model="rejectComment" rows="4" auto-resize class="w-full" />
      <template #footer>
        <Button label="Annuler" text @click="rejectDialogOpen = false" />
        <Button label="Refuser" severity="danger" :loading="submitting" @click="onReject" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.revision-detail {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.revision-detail__header {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
}

.revision-detail__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.revision-detail__profile-link {
  font-size: var(--asb-text-sm);
  color: var(--asb-gold-700);
}

.revision-detail__spacer {
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

.revision-detail__actions {
  display: flex;
  gap: var(--asb-space-3);
}

.dialog-hint {
  margin: 0 0 var(--asb-space-3);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.w-full {
  width: 100%;
}

label {
  display: block;
  font-size: var(--asb-text-sm);
  font-weight: 600;
  margin-bottom: var(--asb-space-1);
}
</style>
