<script setup lang="ts">
// Paramètres > Utilisateurs — désactivation (§A1). Tente d'abord une
// désactivation simple ; si l'API refuse parce que des demandes/
// candidatures/organisations sont assignées, propose EXPLICITEMENT le
// choix (libérer ou réassigner) plutôt que de laisser l'admin deviner un
// second essai -- même esprit que le reste du projet ("propose les
// transitions possibles plutôt que de laisser échouer après coup").
import { computed, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import SelectButton from 'primevue/selectbutton';
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import {
  deactivateUser,
  fetchUsers,
  type UserListItem,
} from '../../../services/users';
import type { ApiError } from '../../../lib/api-error';

const props = defineProps<{ visible: boolean; user: UserListItem }>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  deactivated: [];
}>();

const toast = useToast();

type Choice = 'release' | 'reassign';
const choice = ref<Choice>('release');
const choiceOptions = [
  { value: 'release', label: 'Libérer' },
  { value: 'reassign', label: 'Réassigner à…' },
];

const needsChoice = ref(false);
const assignmentMessage = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const submitting = ref(false);

const recipientQuery = ref('');
const recipientSuggestions = ref<UserListItem[]>([]);
const recipient = ref<UserListItem | null>(null);

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    needsChoice.value = false;
    assignmentMessage.value = null;
    errorMessage.value = null;
    choice.value = 'release';
    recipientQuery.value = '';
    recipient.value = null;
  },
);

async function searchRecipients(event: AutoCompleteCompleteEvent): Promise<void> {
  const res = await fetchUsers({
    page: 1,
    perPage: 10,
    search: event.query,
    status: 'ACTIVE',
  });
  recipientSuggestions.value = res.data.filter((u) => u.id !== props.user.id);
}

function recipientLabel(u: UserListItem): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name ? `${name} <${u.email}>` : u.email;
}

async function attempt(): Promise<void> {
  errorMessage.value = null;
  submitting.value = true;
  try {
    const body = needsChoice.value
      ? choice.value === 'release'
        ? { release: true }
        : { reassignToUserId: recipient.value?.id }
      : {};
    await deactivateUser(props.user.id, body);
    emit('deactivated');
    emit('update:visible', false);
    toast.add({
      severity: 'success',
      summary: 'Compte désactivé',
      detail: `${props.user.email} ne peut plus se connecter.`,
      life: 4000,
    });
  } catch (err) {
    const apiError = err as ApiError;
    const message =
      apiError?.messages?.[0] ?? 'Impossible de désactiver ce compte.';
    if (!needsChoice.value && message.includes('assigné')) {
      needsChoice.value = true;
      assignmentMessage.value = message;
    } else {
      errorMessage.value = message;
    }
  } finally {
    submitting.value = false;
  }
}

const canSubmit = computed(() => {
  if (!needsChoice.value) return true;
  return choice.value === 'release' || !!recipient.value;
});

function close(): void {
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Désactiver ce compte"
    style="width: 480px"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="deactivate-form">
      <p class="confirm-text">
        Désactiver <strong>{{ user.firstName }} {{ user.lastName }} ({{ user.email }})</strong> ?
        Le compte n'est jamais supprimé, seulement désactivé.
      </p>

      <Message v-if="errorMessage" severity="error" :closable="false">{{
        errorMessage
      }}</Message>

      <template v-if="needsChoice">
        <Message severity="warn" :closable="false">{{ assignmentMessage }}</Message>

        <SelectButton
          v-model="choice"
          :options="choiceOptions"
          option-label="label"
          option-value="value"
        />

        <div v-if="choice === 'reassign'" class="field">
          <label>Réassigner à</label>
          <AutoComplete
            v-model="recipientQuery"
            :suggestions="recipientSuggestions"
            :option-label="recipientLabel"
            placeholder="Rechercher un administrateur actif…"
            class="w-full"
            @complete="searchRecipients"
            @item-select="(e) => (recipient = e.value as UserListItem)"
          />
        </div>
      </template>
    </div>

    <template #footer>
      <Button label="Annuler" text @click="close" />
      <Button
        label="Désactiver"
        severity="danger"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="attempt"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.deactivate-form {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.confirm-text {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.w-full {
  width: 100%;
}
</style>
