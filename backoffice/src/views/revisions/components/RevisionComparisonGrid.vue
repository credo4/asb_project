<script setup lang="ts">
// Composant sur mesure n°1 (voir prompt §3.1) : grille de comparaison
// avant/après de la validation de profil. Consomme TEL QUEL le diff calculé
// par l'API (SpeakerRevisionDiffService, voir CLAUDE.md §2a) — ne contient
// déjà QUE les champs réellement différents, aucun recalcul côté client.
import type { RevisionDetail } from '../../../services/speaker-revisions';

defineProps<{
  diff: RevisionDetail['diff'];
}>();

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
</script>

<template>
  <div class="comparison-grid">
    <div
      v-if="diff.scalarChanges.length === 0 && diff.relationChanges.length === 0"
      class="comparison-grid__empty"
    >
      Aucune différence détectée avec la fiche publiée actuelle.
    </div>

    <template v-else>
      <div v-if="diff.scalarChanges.length > 0" class="comparison-table">
        <div class="comparison-table__header">
          <span>Champ</span>
          <span>Avant</span>
          <span>Après</span>
        </div>
        <div
          v-for="change in diff.scalarChanges"
          :key="change.field"
          class="comparison-table__row"
        >
          <span class="comparison-table__label">{{ change.label }}</span>
          <span class="comparison-table__before">{{ formatValue(change.before) }}</span>
          <span class="comparison-table__after">{{ formatValue(change.after) }}</span>
        </div>
      </div>

      <div v-if="diff.relationChanges.length > 0" class="relation-changes">
        <div
          v-for="change in diff.relationChanges"
          :key="change.field"
          class="relation-changes__row"
        >
          <span class="comparison-table__label">{{ change.label }}</span>
          <div class="relation-changes__chips">
            <span
              v-for="item in change.added"
              :key="`added-${item}`"
              class="relation-chip relation-chip--added"
              >+ {{ item }}</span
            >
            <span
              v-for="item in change.removed"
              :key="`removed-${item}`"
              class="relation-chip relation-chip--removed"
              >− {{ item }}</span
            >
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.comparison-grid {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.comparison-grid__empty {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  padding: var(--asb-space-4);
  text-align: center;
}

.comparison-table {
  border: 1px solid var(--asb-border);
}

.comparison-table__header,
.comparison-table__row {
  display: grid;
  grid-template-columns: 200px 1fr 1fr;
  gap: var(--asb-space-4);
  padding: var(--asb-space-3) var(--asb-space-4);
  align-items: start;
}

.comparison-table__header {
  background: var(--asb-surface-hover);
  font-size: var(--asb-text-label);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--asb-text-muted);
}

.comparison-table__row {
  border-top: 1px solid var(--asb-border);
  font-size: var(--asb-text-sm);
}

.comparison-table__label {
  font-weight: 600;
  color: var(--asb-text);
}

.comparison-table__before {
  color: var(--asb-danger-600);
  text-decoration: line-through;
  text-decoration-color: rgba(163, 43, 34, 0.4);
  white-space: pre-wrap;
}

.comparison-table__after {
  color: var(--asb-success-600);
  font-weight: 600;
  white-space: pre-wrap;
}

.relation-changes {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-4);
}

.relation-changes__row {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
}

.relation-changes__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--asb-space-2);
}

.relation-chip {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  padding: 3px 8px;
  border-radius: var(--asb-radius-sm);
  border: 1px solid transparent;
}

.relation-chip--added {
  background: var(--asb-success-50);
  border-color: #c6dbcf;
  color: var(--asb-success-600);
}

.relation-chip--removed {
  background: var(--asb-danger-50);
  border-color: #ebccc8;
  color: var(--asb-danger-600);
}
</style>
