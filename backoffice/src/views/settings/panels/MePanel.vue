<script setup lang="ts">
// Paramètres > Mon compte (§A2) : profil et changement de mot de passe.
// Volontairement PAS de champ "préférences" ici : bucket JSON libre côté
// API sans forme imposée par le cahier des charges, aucun usage concret à
// afficher pour l'instant (voir schema.prisma#User.preferences) -- omis du
// corps PATCH, donc jamais écrasé.
import { reactive, ref, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../../../stores/auth';
import { updateMe, changePassword } from '../../../services/me';
import { mapMessagesToFields, type ApiError } from '../../../lib/api-error';

const auth = useAuthStore();
const toast = useToast();

// --- Profil ---
const profileForm = reactive({ firstName: '', lastName: '', email: '' });
watch(
  () => auth.user,
  (user) => {
    if (!user) return;
    profileForm.firstName = user.firstName ?? '';
    profileForm.lastName = user.lastName ?? '';
    profileForm.email = user.email;
  },
  { immediate: true },
);
const profileFieldErrors = ref<Record<string, string[]>>({});
const savingProfile = ref(false);
async function saveProfile(): Promise<void> {
  profileFieldErrors.value = {};
  savingProfile.value = true;
  try {
    await updateMe({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      email: profileForm.email,
    });
    await auth.fetchMe();
    toast.add({ severity: 'success', summary: 'Profil mis à jour', life: 3000 });
  } catch (err) {
    const apiError = err as ApiError;
    if (apiError?.isValidationError) {
      const { fieldErrors } = mapMessagesToFields(apiError.messages, [
        'firstName',
        'lastName',
        'email',
      ]);
      profileFieldErrors.value = fieldErrors;
    }
  } finally {
    savingProfile.value = false;
  }
}

// --- Mot de passe ---
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const passwordError = ref<string | null>(null);
const changingPassword = ref(false);
async function submitPasswordChange(): Promise<void> {
  passwordError.value = null;
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Les deux mots de passe ne correspondent pas.';
    return;
  }
  changingPassword.value = true;
  try {
    const tokens = await changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
    // La session courante DOIT recevoir la paire fraîche (§A2 : toutes les
    // AUTRES sessions sont invalidées, celle-ci continue sans interruption).
    auth.setTokens(tokens);
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
    toast.add({
      severity: 'success',
      summary: 'Mot de passe changé',
      detail: 'Vos autres sessions ont été déconnectées.',
      life: 4000,
    });
  } catch (err) {
    const apiError = err as ApiError;
    passwordError.value =
      apiError?.messages?.[0] ?? 'Impossible de changer le mot de passe.';
  } finally {
    changingPassword.value = false;
  }
}
</script>

<template>
  <div class="me-panel">
    <section class="detail-card">
      <h2 class="detail-card__title">Profil</h2>
      <div class="form-grid">
        <div class="field">
          <label for="me-first-name">Prénom</label>
          <InputText id="me-first-name" v-model="profileForm.firstName" class="w-full" />
          <small v-for="m in profileFieldErrors.firstName" :key="m" class="field-error">{{ m }}</small>
        </div>
        <div class="field">
          <label for="me-last-name">Nom</label>
          <InputText id="me-last-name" v-model="profileForm.lastName" class="w-full" />
          <small v-for="m in profileFieldErrors.lastName" :key="m" class="field-error">{{ m }}</small>
        </div>
        <div class="field field--wide">
          <label for="me-email">E-mail</label>
          <InputText id="me-email" v-model="profileForm.email" type="email" class="w-full" />
          <small v-for="m in profileFieldErrors.email" :key="m" class="field-error">{{ m }}</small>
        </div>
      </div>
      <Button label="Enregistrer" :loading="savingProfile" @click="saveProfile" />
    </section>

    <section class="detail-card">
      <h2 class="detail-card__title">Changer de mot de passe</h2>
      <Message v-if="passwordError" severity="error" :closable="false">{{ passwordError }}</Message>
      <div class="form-grid">
        <div class="field field--wide">
          <label for="me-current-password">Mot de passe actuel</label>
          <Password
            id="me-current-password"
            v-model="passwordForm.currentPassword"
            :feedback="false"
            toggle-mask
            class="w-full"
            input-class="w-full"
          />
        </div>
        <div class="field">
          <label for="me-new-password">Nouveau mot de passe</label>
          <Password
            id="me-new-password"
            v-model="passwordForm.newPassword"
            toggle-mask
            class="w-full"
            input-class="w-full"
          />
        </div>
        <div class="field">
          <label for="me-confirm-password">Confirmer</label>
          <Password
            id="me-confirm-password"
            v-model="passwordForm.confirmPassword"
            :feedback="false"
            toggle-mask
            class="w-full"
            input-class="w-full"
          />
        </div>
      </div>
      <Button
        label="Changer le mot de passe"
        :loading="changingPassword"
        :disabled="!passwordForm.currentPassword || !passwordForm.newPassword"
        @click="submitPasswordChange"
      />
    </section>
  </div>
</template>

<style scoped>
.me-panel {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.detail-card__title {
  margin: 0;
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--asb-space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.field--wide {
  grid-column: 1 / -1;
}

.field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.field-error {
  color: var(--asb-danger-600);
  font-size: 12px;
}

.w-full {
  width: 100%;
}
</style>
