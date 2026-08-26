<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Message from 'primevue/message';
import { useAuthStore } from '../../stores/auth';
import { mapMessagesToFields, type ApiError } from '../../lib/api-error';
import logo from '../../assets/asb-logo-or.png';

const auth = useAuthStore();
const router = useRouter();

const form = reactive({ email: '', password: '' });
const fieldErrors = ref<Record<string, string[]>>({});
const submitting = ref(false);

const KNOWN_FIELDS = ['email', 'password'] as const;

async function onSubmit(): Promise<void> {
  fieldErrors.value = {};
  submitting.value = true;
  try {
    // Toujours le tableau de bord après connexion -- demandé explicitement
    // (l'ancien comportement suivait `?redirect=`, posé par le garde de
    // route quand une session expirée renvoyait ici depuis une page
    // protégée ; jugé plus perturbant qu'utile en pratique).
    await auth.login(form);
    await router.push({ name: 'dashboard' });
  } catch (err) {
    const apiError = err as ApiError;
    if (apiError?.isValidationError) {
      const { fieldErrors: mapped } = mapMessagesToFields(
        apiError.messages,
        KNOWN_FIELDS,
      );
      fieldErrors.value = mapped;
    }
    // Les erreurs non-validation (ex: "Identifiants invalides") sont déjà
    // notifiées par l'intercepteur global (voir lib/http.ts) — rien à
    // refaire ici.
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="auth-screen">
    <form class="auth-card" @submit.prevent="onSubmit">
      <img :src="logo" alt="Africa Speakers Bureau" class="auth-logo" />
      <h1 class="auth-title">Back-office</h1>
      <p class="auth-subtitle">Connectez-vous pour continuer.</p>

      <div class="field">
        <label for="email">Adresse e-mail</label>
        <InputText
          id="email"
          v-model="form.email"
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

      <div class="field">
        <label for="password">Mot de passe</label>
        <Password
          id="password"
          v-model="form.password"
          :feedback="false"
          toggle-mask
          autocomplete="current-password"
          :invalid="Boolean(fieldErrors.password)"
          input-class="w-full"
          fluid
          required
        />
        <Message
          v-for="message in fieldErrors.password"
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
        label="Se connecter"
        :loading="submitting"
        class="auth-submit"
      />

      <RouterLink :to="{ name: 'forgot-password' }" class="auth-link">
        Mot de passe oublié ?
      </RouterLink>
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

.auth-logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
  margin-bottom: var(--asb-space-2);
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
