<script setup lang="ts">
import Button from 'primevue/button';
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="status-screen">
    <span class="status-screen__code">403</span>
    <h1 class="status-screen__title">Accès refusé</h1>
    <p class="status-screen__text">
      Votre compte n'a pas les droits nécessaires pour accéder à cette page.
    </p>
    <Button label="Retour" @click="router.push({ name: 'dashboard' })" />
  </div>
</template>

<style scoped>
.status-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--asb-space-3);
  background: var(--asb-surface-page);
  text-align: center;
  padding: var(--asb-space-6);
}

.status-screen__code {
  font-family: var(--asb-font-mono);
  font-size: 13px;
  letter-spacing: 0.14em;
  color: var(--asb-gold-700);
}

.status-screen__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.status-screen__text {
  margin: 0 0 var(--asb-space-2);
  max-width: 40ch;
  color: var(--asb-text-muted);
}
</style>
