<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Avatar from 'primevue/avatar';
import Button from 'primevue/button';
import Tooltip from 'primevue/tooltip';
import { useAuthStore } from '../stores/auth';
import { navItems } from '../config/nav';
import NavEntry from './NavEntry.vue';
import logo from '../assets/asb-logo-or.png';

const vTooltip = Tooltip;

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const COLLAPSED_KEY = 'asb_sidebar_collapsed';
const collapsed = ref(localStorage.getItem(COLLAPSED_KEY) === '1');

function toggleCollapsed(): void {
  collapsed.value = !collapsed.value;
  localStorage.setItem(COLLAPSED_KEY, collapsed.value ? '1' : '0');
}

// Fil d'ariane minimal : le nom de la route courante suffit tant qu'il n'y
// a qu'un seul écran protégé (Tableau de bord). Les phases suivantes
// enrichiront `route.meta.breadcrumb` au fil des écrans réels.
const breadcrumbLabel = computed(() => {
  const match = navItems.find((item) => item.to === route.path);
  return match?.label ?? 'Tableau de bord';
});

const userInitials = computed(() => {
  const name = auth.fullName ?? '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
});

async function onLogout(): Promise<void> {
  auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell" :class="{ 'shell--collapsed': collapsed }">
    <!-- Largeur fixe animée + overflow masqué sur l'aside (voir style) :
         le menu se replie TOTALEMENT (0 px), jamais un rail d'icônes --
         le contenu intérieur garde une largeur fixe pour ne jamais se
         redessiner pendant la transition, seule la fenêtre visible change. -->
    <aside class="shell-sidebar">
      <div class="shell-sidebar__inner">
        <div class="shell-sidebar__brand">
          <img :src="logo" alt="Africa Speakers Bureau" class="shell-sidebar__logo" />
        </div>

        <nav class="shell-nav">
          <NavEntry v-for="item in navItems" :key="item.label" :item="item" />

          <!-- Déconnexion : même style que les autres entrées, positionnée
               tout en bas (sous "Paramètres", demandé explicitement),
               jamais un `NavItem` (ce n'est pas une route). -->
          <button type="button" class="shell-nav__item shell-nav__item--action" @click="onLogout">
            <i class="pi pi-sign-out" />
            <span class="shell-nav__label">Déconnexion</span>
          </button>
        </nav>
      </div>
    </aside>

    <div class="shell-body">
      <header class="shell-header">
        <div class="shell-header__left">
          <button
            v-tooltip.bottom="collapsed ? 'Déplier le menu' : 'Replier le menu'"
            type="button"
            class="shell-menu-toggle"
            :aria-label="collapsed ? 'Déplier le menu' : 'Replier le menu'"
            @click="toggleCollapsed"
          >
            <i class="pi pi-bars" />
          </button>
          <nav class="shell-breadcrumb" aria-label="Fil d'ariane">
            <span>{{ breadcrumbLabel }}</span>
          </nav>
        </div>

        <div class="shell-header__actions">
          <Button
            v-tooltip.bottom="'Bientôt disponible'"
            icon="pi pi-bell"
            severity="secondary"
            text
            rounded
            aria-label="Notifications (bientôt disponible)"
            disabled
          />
          <div class="shell-user">
            <Avatar :label="userInitials" shape="circle" />
            <span class="shell-user__name">{{
              auth.fullName ?? auth.user?.email
            }}</span>
          </div>
          <Button
            v-tooltip.bottom="'Déconnexion'"
            icon="pi pi-sign-out"
            severity="secondary"
            text
            rounded
            aria-label="Déconnexion"
            @click="onLogout"
          />
        </div>
      </header>

      <main class="shell-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
  background: var(--asb-surface-page);
}

.shell-sidebar {
  width: 240px;
  flex: none;
  overflow: hidden;
  background: var(--asb-dark-surface-0);
  /* Repli fluide et TOTAL (0 px, jamais un rail d'icônes résiduel). */
  transition: width 260ms cubic-bezier(0.4, 0, 0.2, 1);
}

.shell--collapsed .shell-sidebar {
  width: 0;
}

.shell-sidebar__inner {
  /* Largeur fixe : le contenu ne se redessine jamais pendant l'animation,
     seule la fenêtre visible (overflow masqué du parent) change. */
  width: 240px;
  height: 100%;
  color: var(--asb-dark-text);
  display: flex;
  flex-direction: column;
  padding: var(--asb-space-4) 0;
}

.shell-sidebar__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--asb-space-4) var(--asb-space-6);
}

.shell-sidebar__logo {
  width: 100%;
  max-width: 152px;
  height: auto;
  object-fit: contain;
  flex: none;
}

.shell-nav {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
  flex: 1;
  overflow-y: auto;
}

.shell-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.shell-header {
  height: 56px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--asb-space-6);
  background: var(--asb-surface-card);
  border-bottom: 1px solid var(--asb-border);
}

.shell-header__left {
  display: flex;
  align-items: center;
  gap: var(--asb-space-4);
}

.shell-menu-toggle {
  width: 36px;
  height: 36px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--asb-border-strong);
  color: var(--asb-text-muted);
  border-radius: var(--asb-radius-sm);
  cursor: pointer;
  transition: background var(--asb-duration), color var(--asb-duration);
}

.shell-menu-toggle i {
  font-size: 16px;
}

.shell-menu-toggle:hover {
  background: var(--asb-surface-hover);
  color: var(--asb-text);
}

.shell-breadcrumb {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.shell-header__actions {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
}

.shell-user {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-1) var(--asb-space-2);
  color: var(--asb-text);
}

.shell-user__name {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--asb-space-6);
}
</style>

<!-- Non scoped à dessein : ces classes sont partagées avec NavEntry.vue
     (composant enfant qui rend les items de nav) -- un style `scoped` ici
     n'atteindrait jamais les éléments qu'il rend (le data-v-xxxx de ce
     composant-ci ne se propage pas dans le template d'un enfant). Noms de
     classes assez spécifiques (`shell-nav__*`) pour ne rien risquer
     ailleurs dans l'app. -->
<style>
.shell-nav__item {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  padding: var(--asb-space-2) var(--asb-space-4);
  color: var(--asb-dark-text-muted);
  text-decoration: none;
  font-size: var(--asb-text-sm);
  font-weight: 500;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background var(--asb-duration), color var(--asb-duration);
}

.shell-nav__item i {
  font-size: 16px;
  width: 16px;
  flex: none;
}

.shell-nav__item:hover:not(.shell-nav__item--disabled) {
  background: var(--asb-dark-surface-2);
  color: var(--asb-dark-text);
}

.router-link-exact-active.shell-nav__item {
  background: var(--asb-dark-surface-2);
  color: var(--asb-gold-300);
  border-left-color: var(--asb-gold-500);
}

.shell-nav__item--disabled {
  cursor: default;
  opacity: 0.55;
}

.shell-nav__item--group {
  /* C'est un <button> (en-tête accordéon, ne navigue jamais) --
     réinitialise juste les styles par défaut du bouton, hérite du reste
     (couleur, survol...) de `.shell-nav__item`. */
  width: 100%;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  font-family: inherit;
  font-weight: 600;
  text-align: left;
}

/* Sélecteur à deux classes : plus spécifique que `.shell-nav__item i`
   (une classe + un type), pas besoin de !important pour prendre le pas. */
.shell-nav__item--group .shell-nav__chevron {
  font-size: 12px;
  width: auto;
  flex: none;
}

.shell-nav__label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shell-nav__soon {
  font-family: var(--asb-font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--asb-dark-text-muted);
  border: 1px solid rgba(208, 197, 178, 0.35);
  border-radius: var(--asb-radius-sm);
  padding: 1px 5px;
  flex: none;
}

.shell-nav__children {
  display: flex;
  flex-direction: column;
}

.shell-nav__item--child {
  padding-left: calc(var(--asb-space-4) + 16px + var(--asb-space-3));
  font-size: 13px;
}

/* Déconnexion : un <button>, pas un <a> -- réinitialise juste les styles
   par défaut du bouton, hérite du reste (couleur, survol...) de
   `.shell-nav__item`. Filet séparateur au-dessus (juste avant
   "Paramètres") pour marquer que c'est une action, pas une route. */
.shell-nav__item--action {
  width: 100%;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  border-top: 1px solid rgba(208, 197, 178, 0.16);
  margin-top: var(--asb-space-2);
  padding-top: calc(var(--asb-space-2) + var(--asb-space-2));
  font-family: inherit;
  text-align: left;
}

.shell-nav__item--action:hover {
  /* Teinte "erreur" éclaircie pour fond sombre (voir la règle sur fond
     sombre de la charte, section badges) -- pas un token dédié, juste
     cette seule utilisation ponctuelle ici. */
  color: #e8a19a;
}
</style>
