<script setup lang="ts">
// 4.2 Tableau de bord — indicateurs RÉELS uniquement (voir
// services/dashboard.ts pour l'explication : composés depuis les `meta.total`
// des listes existantes, aucune agrégation n'existe côté API pour l'instant).
import { onMounted, ref } from 'vue';
import Skeleton from 'primevue/skeleton';
import Button from 'primevue/button';
import { useAuthStore } from '../stores/auth';
import { fetchDashboardCounts, type DashboardCounts } from '../services/dashboard';

const auth = useAuthStore();
const counts = ref<DashboardCounts | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    counts.value = await fetchDashboardCounts();
  } catch {
    loadError.value = 'Impossible de charger les indicateurs.';
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div class="dashboard">
    <h1 class="dashboard__title">
      Bienvenue, {{ auth.fullName ?? auth.user?.email }}
    </h1>

    <div v-if="loading" class="dashboard__grid">
      <Skeleton v-for="n in 8" :key="n" height="7rem" />
    </div>

    <div v-else-if="loadError" class="state-block state-block--error">
      <span class="state-block__icon state-block__icon--error">!</span>
      <div class="state-block__title">{{ loadError }}</div>
      <Button label="Réessayer" size="small" @click="load" />
    </div>

    <template v-else-if="counts">
      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Speakers</h2>
        <div class="dashboard__grid">
          <RouterLink :to="{ name: 'speakers-list' }" class="stat-tile">
            <span class="stat-tile__icon"><i class="pi pi-users" /></span>
            <span class="stat-tile__value">{{ counts.speakersTotal }}</span>
            <span class="stat-tile__label">Speakers au total</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'speakers-list', query: { status: 'PUBLISHED' } }"
            class="stat-tile stat-tile--success"
          >
            <span class="stat-tile__icon"><i class="pi pi-check-circle" /></span>
            <span class="stat-tile__value">{{ counts.speakersPublished }}</span>
            <span class="stat-tile__label">Publiés</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'speakers-list', query: { status: 'PENDING_VALIDATION' } }"
            class="stat-tile stat-tile--warn"
          >
            <span class="stat-tile__icon"><i class="pi pi-user-edit" /></span>
            <span class="stat-tile__value">{{ counts.speakersPendingValidation }}</span>
            <span class="stat-tile__label">En attente de validation</span>
          </RouterLink>
          <RouterLink :to="{ name: 'revisions-queue' }" class="stat-tile stat-tile--warn">
            <span class="stat-tile__icon"><i class="pi pi-file-edit" /></span>
            <span class="stat-tile__value">{{ counts.revisionsSubmitted }}</span>
            <span class="stat-tile__label">Révisions à valider</span>
          </RouterLink>
        </div>
      </section>

      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Demandes clients</h2>
        <div class="dashboard__grid">
          <RouterLink :to="{ name: 'booking-requests-inbox' }" class="stat-tile">
            <span class="stat-tile__icon"><i class="pi pi-inbox" /></span>
            <span class="stat-tile__value">{{ counts.bookingRequestsTotal }}</span>
            <span class="stat-tile__label">Au total</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'booking-requests-inbox', query: { status: 'NEW' } }"
            class="stat-tile stat-tile--warn"
          >
            <span class="stat-tile__icon"><i class="pi pi-envelope" /></span>
            <span class="stat-tile__value">{{ counts.bookingRequestsNew }}</span>
            <span class="stat-tile__label">Nouvelles</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'booking-requests-inbox', query: { overdue: 'true' } }"
            class="stat-tile stat-tile--danger"
          >
            <span class="stat-tile__icon"><i class="pi pi-exclamation-triangle" /></span>
            <span class="stat-tile__value">{{ counts.bookingRequestsOverdue }}</span>
            <span class="stat-tile__label">En retard</span>
          </RouterLink>
        </div>
      </section>

      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Candidatures</h2>
        <div class="dashboard__grid">
          <RouterLink :to="{ name: 'roster-applications-list' }" class="stat-tile">
            <span class="stat-tile__icon"><i class="pi pi-id-card" /></span>
            <span class="stat-tile__value">{{ counts.applicationsTotal }}</span>
            <span class="stat-tile__label">Au total</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'roster-applications-list', query: { status: 'NEW' } }"
            class="stat-tile stat-tile--warn"
          >
            <span class="stat-tile__icon"><i class="pi pi-user-plus" /></span>
            <span class="stat-tile__value">{{ counts.applicationsNew }}</span>
            <span class="stat-tile__label">Reçues</span>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard__title {
  margin: 0 0 var(--asb-space-6);
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.dashboard__section {
  margin-bottom: var(--asb-space-6);
}

.dashboard__section-title {
  margin: 0 0 var(--asb-space-3);
  font-size: var(--asb-text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--asb-text-muted);
}

.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--asb-space-4);
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
  padding: var(--asb-space-6);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  border-left: 3px solid transparent;
  text-decoration: none;
  transition: background var(--asb-duration), border-color var(--asb-duration);
}

.stat-tile:hover {
  background: var(--asb-surface-hover);
}

.stat-tile--warn {
  border-left-color: var(--asb-warning-600);
}

.stat-tile--danger {
  border-left-color: var(--asb-danger-600);
}

.stat-tile--success {
  border-left-color: var(--asb-success-600);
}

.stat-tile__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--asb-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: var(--asb-info-50);
  color: var(--asb-info-600);
}

.stat-tile--warn .stat-tile__icon {
  background: var(--asb-warning-50);
  color: var(--asb-warning-600);
}

.stat-tile--danger .stat-tile__icon {
  background: var(--asb-danger-50);
  color: var(--asb-danger-600);
}

.stat-tile--success .stat-tile__icon {
  background: var(--asb-success-50);
  color: var(--asb-success-600);
}

.stat-tile__value {
  font-family: var(--asb-font-mono);
  font-size: var(--asb-text-display);
  font-weight: 600;
  color: var(--asb-text);
  line-height: 1;
}

.stat-tile--warn .stat-tile__value {
  color: var(--asb-warning-600);
}

.stat-tile--danger .stat-tile__value {
  color: var(--asb-danger-600);
}

.stat-tile__label {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-8);
  text-align: center;
}

.state-block--error {
  color: var(--asb-danger-600);
}

.state-block__icon {
  width: 44px;
  height: 44px;
  border: 1px solid var(--asb-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--asb-text-muted);
  font-size: 18px;
}

.state-block__icon--error {
  border-color: var(--asb-danger-600);
  background: var(--asb-danger-50);
  color: var(--asb-danger-600);
  font-weight: 700;
}

.state-block__title {
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}
</style>
