<script setup lang="ts">
// Un seul item de navigation (avec ou sans sous-entrées) -- extrait
// d'AppShell.vue pour éviter de dupliquer ce bloc à chaque endroit où la
// liste de nav est coupée en tranches (voir "Déconnexion insérée sous
// Paramètres"). Un groupe (item AVEC enfants) est un simple en-tête
// pliable, jamais un lien lui-même -- même si `item.to` est `null`, ça ne
// veut PAS dire "bientôt disponible" pour un groupe : ça veut dire "cet
// en-tête ne fait que déplier/replier ses enfants", une chose différente
// de "fonctionnalité pas encore construite" (qui ne s'applique qu'aux
// entrées SANS enfants -- voir la condition `!item.children` ci-dessous).
import { ref } from 'vue';
import type { NavItem } from '../config/nav';

defineProps<{ item: NavItem }>();

// Replié/déplié par groupe, indépendant du repli global de la barre
// latérale (voir prompt : "un peu comme ce menu", référence à un
// accordéon). Ouvert par défaut : un seul groupe aujourd'hui (Speakers),
// pas la peine d'un clic de plus pour y accéder.
const open = ref(true);
</script>

<template>
  <RouterLink
    v-if="!item.children"
    :to="item.to ?? '#'"
    class="shell-nav__item"
    :class="{ 'shell-nav__item--disabled': item.to === null }"
    :aria-disabled="item.to === null ? 'true' : undefined"
    :tabindex="item.to === null ? -1 : undefined"
    @click="
      (event: MouseEvent) => {
        if (item.to === null) event.preventDefault();
      }
    "
  >
    <i :class="item.icon" />
    <span class="shell-nav__label">{{ item.label }}</span>
    <span v-if="item.to === null" class="shell-nav__soon">bientôt</span>
  </RouterLink>

  <div v-else class="shell-nav__group">
    <button
      type="button"
      class="shell-nav__item shell-nav__item--group"
      :aria-expanded="open"
      @click="open = !open"
    >
      <i :class="item.icon" />
      <span class="shell-nav__label">{{ item.label }}</span>
      <i class="shell-nav__chevron" :class="open ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
    </button>
    <div v-if="open" class="shell-nav__children">
      <template v-for="child in item.children" :key="child.label">
        <RouterLink
          v-if="child.to"
          :to="child.to"
          class="shell-nav__item shell-nav__item--child"
        >
          {{ child.label }}
        </RouterLink>
        <span
          v-else
          class="shell-nav__item shell-nav__item--disabled shell-nav__item--child"
        >
          {{ child.label }}
          <span class="shell-nav__soon">bientôt</span>
        </span>
      </template>
    </div>
  </div>
</template>
