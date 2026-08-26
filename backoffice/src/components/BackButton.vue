<script setup lang="ts">
// Bouton retour réutilisé en tête des écrans de détail (fiche speaker,
// formulaire, révision, demande client...). `to` navigue vers une route
// nommée précise (fil ancré au parent logique de l'écran) ; sans `to`,
// retombe sur l'historique du navigateur (router.back()).
import { useRouter, type RouteLocationRaw } from 'vue-router';
import Button from 'primevue/button';

const props = withDefaults(
  defineProps<{
    label?: string;
    to?: RouteLocationRaw;
  }>(),
  { label: 'Retour', to: undefined },
);

const router = useRouter();

function goBack(): void {
  if (props.to) {
    void router.push(props.to);
  } else {
    router.back();
  }
}
</script>

<template>
  <Button
    :label="label"
    icon="pi pi-arrow-left"
    text
    severity="secondary"
    size="small"
    class="back-button"
    @click="goBack"
  />
</template>

<style scoped>
.back-button {
  padding-left: 0;
  margin-bottom: var(--asb-space-2);
  color: var(--asb-text-muted);
}
</style>
