<script setup lang="ts">
// 2. Fiche organisation (module Clients, ligne 5.12) : consultation
// uniquement -- informations, contacts, historique des demandes ET des
// missions (cliquables), notes internes. Pas d'édition ici (voir
// CLAUDE.md/prompt : "module court, consultation et rattachement").
import { ref, watchEffect } from 'vue';
import { RouterLink } from 'vue-router';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import BackButton from '../../components/BackButton.vue';
import StatusTag from '../../components/StatusTag.vue';
import { fetchOrganization, type OrganizationDetail } from '../../services/organizations';
import { bookingStatusInfo, SERVICE_TYPE_LABELS } from '../../config/booking-status';
import { missionStatusInfo } from '../../config/mission-status';

const props = defineProps<{ id: number }>();

const org = ref<OrganizationDetail | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    org.value = await fetchOrganization(props.id);
  } catch {
    loadError.value = 'Impossible de charger cette organisation.';
  } finally {
    loading.value = false;
  }
}
watchEffect(() => {
  void load();
});

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—';
}
</script>

<template>
  <div class="org-detail">
    <div v-if="loading" class="org-detail__skeleton">
      <Skeleton height="2rem" width="18rem" />
      <Skeleton height="12rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else-if="org">
      <BackButton :to="{ name: 'clients-list' }" label="Clients" />

      <div class="org-detail__header">
        <div class="org-detail__identity">
          <h1 class="org-detail__title">{{ org.name }}</h1>
          <p class="org-detail__subtitle">
            {{ org.sector ?? 'Secteur non renseigné' }}
            <span v-if="org.country"> · {{ org.country.name }}</span>
          </p>
        </div>
      </div>

      <section class="detail-card">
        <h2 class="detail-card__title">Informations</h2>
        <dl class="detail-grid">
          <div><dt>Nom</dt><dd>{{ org.name }}</dd></div>
          <div><dt>Secteur</dt><dd>{{ org.sector ?? '—' }}</dd></div>
          <div><dt>Pays</dt><dd>{{ org.country?.name ?? '—' }}</dd></div>
          <div>
            <dt>Site web</dt>
            <dd>
              <a v-if="org.website" :href="org.website" target="_blank" rel="noopener">{{ org.website }}</a>
              <template v-else>—</template>
            </dd>
          </div>
          <div>
            <dt>Administrateur responsable</dt>
            <dd>
              {{
                org.assignedAdmin
                  ? `${org.assignedAdmin.firstName ?? ''} ${org.assignedAdmin.lastName ?? ''}`.trim() ||
                    org.assignedAdmin.email
                  : '—'
              }}
            </dd>
          </div>
          <div><dt>Créée le</dt><dd>{{ formatDate(org.createdAt) }}</dd></div>
        </dl>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Notes internes</h2>
        <p v-if="org.internalNotes" class="notes-text">{{ org.internalNotes }}</p>
        <p v-else class="detail-card__hint">Aucune note interne.</p>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Contacts rattachés</h2>
        <ul v-if="org.contacts.length > 0" class="ref-list">
          <li v-for="c in org.contacts" :key="c.id">
            <RouterLink :to="{ name: 'contact-detail', params: { id: c.id } }" class="ref-row">
              <span class="ref-row__main">{{ c.firstName }} {{ c.lastName }}</span>
              <span class="ref-row__meta">{{ c.jobTitle ?? '—' }} · {{ c.email }}</span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="detail-card__hint">Aucun contact rattaché.</p>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Historique des demandes</h2>
        <ul v-if="org.bookingRequests.length > 0" class="ref-list">
          <li v-for="r in org.bookingRequests" :key="r.id">
            <RouterLink :to="{ name: 'booking-request-detail', params: { id: r.id } }" class="ref-row">
              <span class="ref-row__main">{{ r.reference }}</span>
              <span class="ref-row__meta">{{ SERVICE_TYPE_LABELS[r.serviceType] ?? r.serviceType }} · {{ formatDate(r.createdAt) }}</span>
              <StatusTag :label="bookingStatusInfo(r.status).label" :family="bookingStatusInfo(r.status).family" />
            </RouterLink>
          </li>
        </ul>
        <p v-else class="detail-card__hint">Aucune demande pour l'instant.</p>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Historique des missions</h2>
        <ul v-if="org.missions.length > 0" class="ref-list">
          <li v-for="m in org.missions" :key="m.id">
            <RouterLink :to="{ name: 'mission-detail', params: { id: m.id } }" class="ref-row">
              <span class="ref-row__main">{{ m.reference }}</span>
              <span class="ref-row__meta">{{ m.speaker.displayName }} · {{ formatDate(m.eventDate) }}</span>
              <StatusTag :label="missionStatusInfo(m.status).label" :family="missionStatusInfo(m.status).family" />
            </RouterLink>
          </li>
        </ul>
        <p v-else class="detail-card__hint">Aucune mission pour l'instant.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.org-detail {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.org-detail__header {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  flex-wrap: wrap;
}

.org-detail__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.org-detail__subtitle {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
}

.detail-card__title {
  margin: 0 0 var(--asb-space-4);
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.detail-card__hint {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.notes-text {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text);
  white-space: pre-wrap;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--asb-space-4);
  margin: 0;
}

.detail-grid dt {
  font-size: var(--asb-text-label);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--asb-text-muted);
  margin-bottom: var(--asb-space-1);
}

.detail-grid dd {
  margin: 0;
  color: var(--asb-text);
}

.ref-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.ref-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  padding: var(--asb-space-2) var(--asb-space-3);
  border: 1px solid var(--asb-border);
  text-decoration: none;
  color: inherit;
}

.ref-row:hover {
  border-color: var(--asb-border-strong);
  background: var(--asb-surface-sunken);
}

.ref-row__main {
  font-weight: 600;
  color: var(--asb-text);
}

.ref-row__meta {
  flex: 1;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}
</style>
