<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import { http } from '../../lib/http';
import { mapMessagesToFields, type ApiError } from '../../lib/api-error';
import type { ApiRequestBody } from '../../types/api-helpers';

type ForgotPasswordBody = ApiRequestBody<'/auth/forgot-password', 'post'>;

const email = ref('');
const fieldErrors = ref<Record<string, string[]>>({});
const submitting = ref(false);
const sent = ref(false);

async function onSubmit(): Promise<void> {
  fieldErrors.value = {};
  submitting.value = true;
  try {
    const body: ForgotPasswordBody = { email: email.value };
    await http.post('/auth/forgot-password', body);
    // Toujours le même message, que l'e-mail existe ou non côté API
    // (anti-énumération de comptes — même principe que l'API elle-même).
    sent.value = true;
  } catch (err) {
    const apiError = err as ApiError;
    if (apiError?.isValidationError) {
      const { fieldErrors: mapped } = mapMessagesToFields(
        apiError.messages,
        ['email'],
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
    <div v-if="sent" class="auth-card">
      <h1 class="auth-title">E-mail envoyé</h1>
      <p class="auth-subtitle">
        Si un compte existe pour cette adresse, un lien de réinitialisation
        vient d'être envoyé.
      </p>
      <RouterLink :to="{ name: 'login' }" class="auth-link"
        >Retour à la connexion</RouterLink
      >
    </div>
    <form v-else class="auth-card" @submit.prevent="onSubmit">
      <h1 class="auth-title">Mot de passe oublié</h1>
      <p class="auth-subtitle">
        Indiquez votre adresse e-mail, nous vous enverrons un lien de
        réinitialisation.
      </p>

      <div class="field">
        <label for="email">Adresse e-mail</label>
        <InputText
          id="email"
          v-model="email"
          type="email"
          autocomplete="username"
          :invalid="Boolean(fieldErrors.email)"
          required
        />
        <Message
          v-for="message in fieldErrors.email"
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
        label="Envoyer le lien"
        :loading="submitting"
        class="auth-submit"
      />
      <RouterLink :to="{ name: 'login' }" class="auth-link"
        >Retour à la connexion</RouterLink
      >
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
