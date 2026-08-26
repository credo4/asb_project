<script setup lang="ts">
// Fine couche au-dessus de PrimeVue <Tag> — pas un des 3 composants sur
// mesure du système de design : Tag ne connaît que 5 sévérités
// (success/info/warn/danger/secondary), il en manque une pour la famille
// « distinction » (or) du système de design. Ce wrapper ajoute juste la
// classe CSS correspondante quand family === 'gold'.
import Tag from 'primevue/tag';
import type { BadgeFamily } from '../config/speaker-status';

defineProps<{
  label: string;
  family: BadgeFamily;
}>();
</script>

<template>
  <Tag
    :value="label"
    :severity="family === 'gold' ? undefined : family"
    :class="family === 'gold' ? 'status-tag--gold' : undefined"
  />
</template>

<style scoped>
/* La classe atterrit directement sur l'élément racine de <Tag> (pas un de
   ses descendants — les classes transmises à un composant enfant sont
   fusionnées sur SA racine) : `:global()`, pas `:deep()` qui suppose une
   relation ancêtre/descendant qui n'existe pas ici. */
:global(.status-tag--gold) {
  background: var(--asb-gold-50) !important;
  border: 1px solid var(--asb-gold-300) !important;
  color: var(--asb-gold-700) !important;
}
</style>
