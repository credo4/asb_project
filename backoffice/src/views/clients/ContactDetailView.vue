<script setup lang="ts">
// 3. Fiche contact (module Clients, ligne 5.12) : identité, coordonnées,
// organisation, historique de ses demandes. Consultation uniquement.
import { ref, watchEffect } from 'vue';
import { RouterLink } from 'vue-router';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import BackButton from '../../components/BackButton.vue';
import StatusTag from '../../components/StatusTag.vue';
import { fetchContact, type ContactDetail } from '../../services/contacts';
import { bookingStatusInfo, SERVICE_TYPE_LABELS } from '../../config/booking-status';

const props = defineProps<{ id: number }>();

const contact = ref<ContactDetail | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    contact.value = await fetchContact(props.id);
  } catch {
    loadError.value = 'Impossible de charger ce contact.';
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
  <div class="contact-detail">
    <div v-if="loading" class="contact-detail__skeleton">
      <Skeleton height="2rem" width="18rem" />
      <Skeleton height="12rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else-if="contact">
      <BackButton :to="{ name: 'clients-list' }" label="Clients" />

      <div class="contact-detail__header">
        <div class="contact-detail__identity">
          <h1 class="contact-detail__title">{{ contact.firstName }} {{ contact.lastName }}</h1>
          <p class="contact-detail__subtitle">
            {{ contact.jobTitle ?? 'Fonction non renseignée' }}
            <span v-if="contact.organization"> · {{ contact.organization.name }}</span>
          </p>
        </div>
      </div>

      <section class="detail-card">
        <h2 class="detail-card__title">Identité et coordonnées</h2>
        <dl class="detail-grid">
          <div><dt>Nom</dt><dd>{{ contact.firstName }} {{ contact.lastName }}</dd></div>
          <div><dt>Fonction</dt><dd>{{ contact.jobTitle ?? '—' }}</dd></div>
          <div><dt>E-mail</dt><dd>{{ contact.email }}</dd></div>
          <div><dt>Téléphone</dt><dd>{{ contact.phone ?? '—' }}</dd></div>
          <div><dt>Pays</dt><dd>{{ contact.country?.name ?? '—' }}</dd></div>
          <div>
            <dt>Organisation</dt>
            <dd>
              <RouterLink
                v-if="contact.organization"
                :to="{ name: 'organization-detail', params: { id: contact.organization.id } }"
              >
                {{ contact.organization.name }}
              </RouterLink>
              <template v-else>—</template>
            </dd>
          </div>
        </dl>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Notes internes</h2>
        <p v-if="contact.internalNotes" class="notes-text">{{ contact.internalNotes }}</p>
        <p v-else class="detail-card__hint">Aucune note interne.</p>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Historique de ses demandes</h2>
        <ul v-if="contact.bookingRequests.length > 0" class="ref-list">
          <li v-for="r in contact.bookingRequests" :key="r.id">
            <RouterLink :to="{ name: 'booking-request-detail', params: { id: r.id } }" class="ref-row">
              <span class="ref-row__main">{{ r.reference }}</span>
              <span class="ref-row__meta">{{ SERVICE_TYPE_LABELS[r.serviceType] ?? r.serviceType }} · {{ formatDate(r.createdAt) }}</span>
              <StatusTag :label="bookingStatusInfo(r.status).label" :family="bookingStatusInfo(r.status).family" />
            </RouterLink>
          </li>
        </ul>
        <p v-else class="detail-card__hint">Aucune demande pour l'instant.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.contact-detail {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.contact-detail__header {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  flex-wrap: wrap;
}

.contact-detail__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.contact-detail__subtitle {
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
