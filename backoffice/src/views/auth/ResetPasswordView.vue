<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Password from 'primevue/password';
import Message from 'primevue/message';
import { http } from '../../lib/http';
import { mapMessagesToFields, type ApiError } from '../../lib/api-error';
import type { ApiRequestBody } from '../../types/api-helpers';

type ResetPasswordBody = ApiRequestBody<'/auth/reset-password', 'post'>;

const route = useRoute();
const router = useRouter();

const token =
  typeof route.query.token === 'string' ? route.query.token : '';
const newPassword = ref('');
const fieldErrors = ref<Record<string, string[]>>({});
const submitting = ref(false);
const done = ref(false);

async function onSubmit(): Promise<void> {
  fieldErrors.value = {};
  submitting.value = true;
  try {
    const body: ResetPasswordBody = { token, newPassword: newPassword.value };
    await http.post('/auth/reset-password', body);
    done.value = true;
  } catch (err) {
    const apiError = err as ApiError;
    if (apiError?.isValidationError) {
      const { fieldErrors: mapped } = mapMessagesToFields(
        apiError.messages,
        ['newPassword', 'token'],
      );
      fieldErrors.value = mapped;
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="auth-screen">
    <div v-if="!token" class="auth-card">
      <h1 class="auth-title">Lien invalide</h1>
      <p class="auth-subtitle">
        Ce lien de réinitialisation est incomplet. Demandez-en un nouveau.
      </p>
      <RouterLink :to="{ name: 'forgot-password' }" class="auth-link"
        >Demander un nouveau lien</RouterLink
      >
    </div>
    <div v-else-if="done" class="auth-card">
      <h1 class="auth-title">Mot de passe mis à jour</h1>
      <p class="auth-subtitle">Vous pouvez maintenant vous connecter.</p>
      <Button
        label="Se connecter"
        @click="router.push({ name: 'login' })"
      />
    </div>
    <form v-else class="auth-card" @submit.prevent="onSubmit">
      <h1 class="auth-title">Nouveau mot de passe</h1>

      <div class="field">
        <label for="newPassword">Nouveau mot de passe</label>
        <Password
          id="newPassword"
          v-model="newPassword"
          toggle-mask
          autocomplete="new-password"
          :invalid="Boolean(fieldErrors.newPassword)"
          fluid
          required
        />
        <Message
          v-for="message in fieldErrors.newPassword"
          :key="message"
          severity="error"
          variant="simple"
          size="small"
        >
          {{ message }}
        </Message>
      </div>

      <Button
        type="submit"
        label="Mettre à jour"
        :loading="submitting"
        class="auth-submit"
      />
    </form>
  </div>
</template>

<style scoped>
.auth-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--asb-surface-page);
  padding: var(--asb-space-6);
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  box-shadow: var(--asb-shadow-2);
  padding: var(--asb-space-8);
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.auth-title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.auth-subtitle {
  margin: calc(var(--asb-space-2) * -1) 0 var(--asb-space-2);
  font-size: var(--asb-text-sm);
  line-height: var(--asb-leading-body);
  color: var(--asb-text-muted);
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

.auth-submit {
  margin-top: var(--asb-space-2);
}

.auth-link {
  align-self: center;
  font-size: var(--asb-text-sm);
  color: var(--asb-gold-700);
  text-decoration: none;
}

.auth-link:hover {
  text-decoration: underline;
}
</style>
