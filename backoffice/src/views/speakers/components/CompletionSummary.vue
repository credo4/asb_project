<script setup lang="ts">
// Composant sur mesure n°2 (voir prompt §2.3) : sommaire ancré à complétion
// de la fiche speaker.
//
// Deux notions DÉLIBÉRÉMENT séparées, jamais confondues :
// - `overallScore` (optionnel) : le VRAI score de complétion calculé par
//   l'API (`SpeakerDetailDto.completionScore`, voir
//   backend/completion-score.util.ts) — n'existe qu'une fois le speaker
//   créé, jamais deviné ni recalculé ici.
// - `sections[].filled` : un indicateur LOCAL, purement visuel, "cette
//   section a au moins ses champs clés remplis" — calculé côté formulaire
//   (voir SpeakerFormView) sur des critères volontairement simples, sans
//   reproduire la pondération exacte du score serveur (qui pourrait changer
//   indépendamment). Sert à la navigation, pas de promesse de pourcentage.
export interface CompletionSection {
  id: string;
  label: string;
  filled: boolean;
}

defineProps<{
  sections: CompletionSection[];
  overallScore?: number;
  activeId?: string;
}>();

function scrollTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <nav class="completion-summary" aria-label="Sections du formulaire">
    <div v-if="overallScore !== undefined" class="completion-summary__score">
      <div class="completion-summary__score-row">
        <span>Complétion</span>
        <span class="completion-summary__score-value">{{ overallScore }} %</span>
      </div>
      <div class="completion-summary__bar">
        <span
          class="completion-summary__bar-fill"
          :style="{ width: `${overallScore}%` }"
        />
      </div>
    </div>

    <ul class="completion-summary__list">
      <li v-for="section in sections" :key="section.id">
        <button
          type="button"
          class="completion-summary__item"
          :class="{ 'completion-summary__item--active': activeId === section.id }"
          @click="scrollTo(section.id)"
        >
          <span
            class="completion-summary__dot"
            :class="{ 'completion-summary__dot--filled': section.filled }"
          />
          {{ section.label }}
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.completion-summary {
  position: sticky;
  top: var(--asb-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
  padding: var(--asb-space-4);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  min-width: 200px;
}

.completion-summary__score-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
  margin-bottom: var(--asb-space-1);
}

.completion-summary__score-value {
  font-family: var(--asb-font-mono);
  color: var(--asb-gold-700);
}

.completion-summary__bar {
  height: 8px;
  background: var(--asb-surface-sunken);
  border-radius: var(--asb-radius-full);
  overflow: hidden;
}

.completion-summary__bar-fill {
  display: block;
  height: 100%;
  background: var(--asb-gold-500);
}

.completion-summary__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.completion-summary__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-2);
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  text-align: left;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  cursor: pointer;
  border-radius: var(--asb-radius-sm);
}

.completion-summary__item:hover {
  background: var(--asb-surface-hover);
  color: var(--asb-text);
}

.completion-summary__item--active {
  color: var(--asb-text);
  font-weight: 600;
  border-left-color: var(--asb-gold-500);
  background: var(--asb-surface-hover);
}

.completion-summary__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: 1px solid var(--asb-border-strong);
  flex: none;
}

.completion-summary__dot--filled {
  background: var(--asb-success-600);
  border-color: var(--asb-success-600);
}
</style>
