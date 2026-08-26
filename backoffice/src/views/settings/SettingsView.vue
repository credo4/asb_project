<script setup lang="ts">
// Paramètres (§28, ligne 5.13) : quatre onglets. Coquille fine, chaque
// onglet est un panneau séparé (voir ./panels/) -- même principe que
// "Aperçu"/"Historique" sur MissionDetailView.vue. Onglet actif reflété
// dans l'URL (`?tab=...`, router.replace jamais push -- même convention
// que useApiList) pour rester partageable/rafraîchissable.
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import UsersPanel from './panels/UsersPanel.vue';
import MePanel from './panels/MePanel.vue';
import GeneralPanel from './panels/GeneralPanel.vue';
import SecurityPanel from './panels/SecurityPanel.vue';

const route = useRoute();
const router = useRouter();

const VALID_TABS = ['users', 'me', 'general', 'security'] as const;
type TabKey = (typeof VALID_TABS)[number];

const activeTab = computed<TabKey>({
  get() {
    const raw = route.query.tab;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return (VALID_TABS as readonly string[]).includes(value ?? '')
      ? (value as TabKey)
      : 'users';
  },
  set(value: TabKey) {
    void router.replace({ query: { ...route.query, tab: value } });
  },
});
</script>

<template>
  <div class="settings-view">
    <h1 class="settings-view__title">Paramètres</h1>

    <Tabs :value="activeTab" @update:value="(v) => (activeTab = v as TabKey)">
      <TabList>
        <Tab value="users">Utilisateurs</Tab>
        <Tab value="me">Mon compte</Tab>
        <Tab value="general">Général</Tab>
        <Tab value="security">Sécurité</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="users">
          <UsersPanel />
        </TabPanel>
        <TabPanel value="me">
          <MePanel />
        </TabPanel>
        <TabPanel value="general">
          <GeneralPanel />
        </TabPanel>
        <TabPanel value="security">
          <SecurityPanel />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.settings-view__title {
  margin: 0 0 var(--asb-space-4);
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}
</style>
