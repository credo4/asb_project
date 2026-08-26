<script setup lang="ts">
// Paramètres > Utilisateurs — invitation (§A1). Réutilise le mécanisme de
// token de la 3c (voir CLAUDE.md) : ce formulaire ne demande JAMAIS de mot
// de passe, seulement l'identité et le rôle -- le destinataire le définit
// lui-même via le lien reçu par email.
import { reactive, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { inviteUser, type CreateUserInviteBody } from '../../../services/users';
import { ROLE_LABELS } from '../../../config/user-status';
import type { ApiError } from '../../../lib/api-error';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  invited: [];
}>();

const toast = useToast();
const roleOptions = [
  { value: 'ADMIN', label: ROLE_LABELS.ADMIN },
  { value: 'SUPER_ADMIN', label: ROLE_LABELS.SUPER_ADMIN },
];

function emptyForm(): CreateUserInviteBody {
  return { email: '', firstName: '', lastName: '', role: 'ADMIN' };
}
const form = reactive<CreateUserInviteBody>(emptyForm());
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    Object.assign(form, emptyForm());
    errorMessage.value = null;
  },
);

async function onSubmit(): Promise<void> {
  errorMessage.value = null;
  submitting.value = true;
  try {
    const result = await inviteUser(form);
    emit('invited');
    emit('update:visible', false);
    toast.add({
      severity: result.invitationSent ? 'success' : 'warn',
      summary: result.invitationSent
        ? 'Invitation envoyée'
        : "Compte créé, l'email a échoué",
      detail: result.invitationSent
        ? `${form.email} peut définir son mot de passe via le lien reçu.`
        : `${form.email} a été créé, mais l'envoi a échoué -- à renvoyer manuellement.`,
      life: 5000,
    });
  } catch (err) {
    const apiError = err as ApiError;
    errorMessage.value =
      apiError?.messages?.[0] ?? "Impossible d'inviter cet utilisateur.";
  } finally {
    submitting.value = false;
  }
}

function close(): void {
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Inviter un utilisateur"
    style="width: 480px"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="invite-form">
      <Message severity="info" :closable="false">
        Aucun mot de passe à saisir ici : un lien d'invitation est envoyé,
        la personne le définit elle-même.
      </Message>

      <Message v-if="errorMessage" severity="error" :closable="false">{{
        errorMessage
      }}</Message>

      <div class="field">
        <label for="invite-email">E-mail *</label>
        <InputText id="invite-email" v-model="form.email" type="email" class="w-full" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="invite-first-name">Prénom *</label>
          <InputText id="invite-first-name" v-model="form.firstName" class="w-full" />
        </div>
        <div class="field">
          <label for="invite-last-name">Nom *</label>
          <InputText id="invite-last-name" v-model="form.lastName" class="w-full" />
        </div>
      </div>
      <div class="field">
        <label for="invite-role">Rôle *</label>
        <Select
          id="invite-role"
          v-model="form.role"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Annuler" text @click="close" />
      <Button
        label="Envoyer l'invitation"
        :loading="submitting"
        :disabled="!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()"
        @click="onSubmit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.invite-form {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--asb-space-4);
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
