<script setup lang="ts">
// 3.5 Checklist opérationnelle -- "l'élément le plus parlant de l'écran"
// (prompt). Barre de progression en haut, 15 points cochables avec auteur
// + date de chaque coche.
import { ref } from 'vue';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';
import ProgressBar from 'primevue/progressbar';
import { useToast } from 'primevue/usetoast';
import type { MissionDetail } from '../../../services/missions';
import { toggleChecklistItem, addChecklistItem } from '../../../services/mission-checklist';

const props = defineProps<{
  missionId: number;
  items: MissionDetail['checklist'];
  progress: number;
}>();
const emit = defineEmits<{ changed: [] }>();

const toast = useToast();

const toggling = ref<number | null>(null);
async function onToggle(item: MissionDetail['checklist'][number], isDone: boolean): Promise<void> {
  toggling.value = item.id;
  try {
    await toggleChecklistItem(props.missionId, item.id, { isDone });
    emit('changed');
  } finally {
    toggling.value = null;
  }
}

const notesDialogOpen = ref(false);
const notesDialogItem = ref<MissionDetail['checklist'][number] | null>(null);
const notesDraft = ref('');
function openNotes(item: MissionDetail['checklist'][number]): void {
  notesDialogItem.value = item;
  notesDraft.value = item.notes ?? '';
  notesDialogOpen.value = true;
}
const savingNotes = ref(false);
async function saveNotes(): Promise<void> {
  if (!notesDialogItem.value) return;
  savingNotes.value = true;
  try {
    await toggleChecklistItem(props.missionId, notesDialogItem.value.id, {
      isDone: notesDialogItem.value.isDone,
      notes: notesDraft.value || undefined,
    });
    notesDialogOpen.value = false;
    emit('changed');
    toast.add({ severity: 'success', summary: 'Note enregistrée', life: 3000 });
  } finally {
    savingNotes.value = false;
  }
}

const newItemLabel = ref('');
const adding = ref(false);
async function onAddItem(): Promise<void> {
  if (!newItemLabel.value.trim()) return;
  adding.value = true;
  try {
    await addChecklistItem(props.missionId, { label: newItemLabel.value });
    newItemLabel.value = '';
    emit('changed');
    toast.add({ severity: 'success', summary: 'Point ajouté', life: 3000 });
  } finally {
    adding.value = false;
  }
}

function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}
</script>

<template>
  <section class="detail-card">
    <h2 class="detail-card__title">Checklist opérationnelle</h2>

    <div class="checklist-progress">
      <div class="checklist-progress__row">
        <span>Avancement</span>
        <span class="checklist-progress__value">{{ progress }} %</span>
      </div>
      <ProgressBar :value="progress" :show-value="false" style="height: 8px" />
    </div>

    <ul class="checklist-items">
      <li v-for="item in items" :key="item.id" class="checklist-item">
        <Checkbox
          :model-value="item.isDone"
          binary
          :disabled="toggling === item.id"
          @update:model-value="(v: boolean) => onToggle(item, v)"
        />
        <div class="checklist-item__body">
          <span class="checklist-item__label" :class="{ 'checklist-item__label--done': item.isDone }">{{
            item.label
          }}</span>
          <span v-if="item.isDone" class="checklist-item__meta"
            >Coché par {{ item.doneByEmail ?? '—' }} le {{ formatDateTime(item.doneAt) }}</span
          >
          <span v-if="item.notes" class="checklist-item__notes">« {{ item.notes }} »</span>
        </div>
        <Button icon="pi pi-pencil" text rounded size="small" aria-label="Note" @click="openNotes(item)" />
      </li>
    </ul>

    <div class="checklist-add">
      <InputText
        v-model="newItemLabel"
        placeholder="Ajouter un point propre à cette mission…"
        class="checklist-add__input"
      />
      <Button
        label="Ajouter"
        size="small"
        :loading="adding"
        :disabled="!newItemLabel.trim()"
        @click="onAddItem"
      />
    </div>

    <Dialog v-model:visible="notesDialogOpen" header="Note de checklist" modal style="width: 420px">
      <p v-if="notesDialogItem" class="dialog-hint">{{ notesDialogItem.label }}</p>
      <Textarea v-model="notesDraft" rows="3" auto-resize class="w-full" />
      <template #footer>
        <Button label="Annuler" text @click="notesDialogOpen = false" />
        <Button label="Enregistrer" :loading="savingNotes" @click="saveNotes" />
      </template>
    </Dialog>
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

.checklist-progress {
  margin-bottom: var(--asb-space-4);
}

.checklist-progress__row {
  display: flex;
  justify-content: space-between;
  font-size: var(--asb-text-sm);
  font-weight: 600;
  margin-bottom: var(--asb-space-1);
}

.checklist-progress__value {
  font-family: var(--asb-font-mono);
  color: var(--asb-gold-700);
}

.checklist-items {
  list-style: none;
  margin: 0 0 var(--asb-space-4);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.checklist-item {
  display: flex;
  align-items: flex-start;
  gap: var(--asb-space-3);
  padding: var(--asb-space-2);
  border-bottom: 1px solid var(--asb-border);
}

.checklist-item__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checklist-item__label {
  font-size: var(--asb-text-sm);
  color: var(--asb-text);
}

.checklist-item__label--done {
  color: var(--asb-text-muted);
  text-decoration: line-through;
}

.checklist-item__meta {
  font-size: 12px;
  color: var(--asb-text-muted);
}

.checklist-item__notes {
  font-size: 12px;
  font-style: italic;
  color: var(--asb-text-muted);
}

.checklist-add {
  display: flex;
  gap: var(--asb-space-2);
}

.checklist-add__input {
  flex: 1;
}

.dialog-hint {
  margin: 0 0 var(--asb-space-2);
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.w-full {
  width: 100%;
}
</style>
