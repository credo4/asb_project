<script setup lang="ts">
// 4. Bloc « Fiche client (CRM) » (module Clients, ligne 5.12 -- "la partie
// utile"). Distinct du bloc « Client » plus haut sur cet écran, qui affiche
// les données BRUTES et IMMUABLES soumises par le prospect (voir CLAUDE.md
// §5) : ce bloc-ci montre le RATTACHEMENT, une décision d'équipe séparée et
// postérieure, jamais fusionnée avec les données d'origine.
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import Button from 'primevue/button';
import ClientLinkDialog from './ClientLinkDialog.vue';
import type { BookingRequestDetail } from '../../../services/booking-requests';

defineProps<{ request: BookingRequestDetail }>();
const emit = defineEmits<{ updated: [request: BookingRequestDetail] }>();

const dialogOpen = ref(false);

function onLinked(updated: BookingRequestDetail): void {
  emit('updated', updated);
}
</script>

<template>
  <section class="detail-card">
    <div class="client-link__header">
      <h2 class="detail-card__title">Fiche client (CRM)</h2>
      <Button
        v-if="!request.linkedContact && !request.linkedOrganization"
        label="Rattacher un client"
        icon="pi pi-link"
        size="small"
        @click="dialogOpen = true"
      />
      <Button
        v-else
        label="Modifier le rattachement"
        icon="pi pi-pencil"
        size="small"
        text
        @click="dialogOpen = true"
      />
    </div>

    <div v-if="!request.linkedContact && !request.linkedOrganization" class="state-block">
      <span class="state-block__icon">＋</span>
      <div class="state-block__title">Pas encore rattachée à une fiche client</div>
      <p class="state-block__text">
        Rattache cette demande à un contact/une organisation existants, ou
        crée-les à partir des données ci-dessus.
      </p>
    </div>

    <div v-else class="linked-cards">
      <RouterLink
        v-if="request.linkedOrganization"
        :to="{ name: 'organization-detail', params: { id: request.linkedOrganization.id } }"
        class="linked-card"
      >
        <i class="pi pi-building" />
        <div>
          <span class="linked-card__label">Organisation</span>
          <span class="linked-card__value">{{ request.linkedOrganization.name }}</span>
        </div>
      </RouterLink>
      <RouterLink
        v-if="request.linkedContact"
        :to="{ name: 'contact-detail', params: { id: request.linkedContact.id } }"
        class="linked-card"
      >
        <i class="pi pi-user" />
        <div>
          <span class="linked-card__label">Contact</span>
          <span class="linked-card__value"
            >{{ request.linkedContact.firstName }} {{ request.linkedContact.lastName }}</span
          >
        </div>
      </RouterLink>
    </div>

    <p class="client-link__hint">
      Fiche CRM distincte des données du formulaire d'origine (section « Client » ci-dessus) --
      le rattachement ne les modifie jamais.
    </p>

    <ClientLinkDialog v-model:visible="dialogOpen" :request="request" @linked="onLinked" />
  </section>
</template>

<style scoped>
.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
}

.detail-card__title {
  margin: 0;
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.client-link__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--asb-space-4);
}

.client-link__hint {
  margin: var(--asb-space-3) 0 0;
  font-size: 12px;
  color: var(--asb-text-muted);
  font-style: italic;
}

.linked-cards {
  display: flex;
  flex-wrap: wrap;
  gap: var(--asb-space-3);
}

.linked-card {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-3);
  border: 1px solid var(--asb-border);
  text-decoration: none;
  color: inherit;
  min-width: 220px;
}

.linked-card:hover {
  border-color: var(--asb-border-strong);
  background: var(--asb-surface-sunken);
}

.linked-card i {
  font-size: 20px;
  color: var(--asb-gold-700);
}

.linked-card__label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--asb-text-muted);
}

.linked-card__value {
  display: block;
  font-weight: 600;
  color: var(--asb-text);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-6);
  text-align: center;
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

.state-block__title {
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}

.state-block__text {
  margin: 0;
  max-width: 420px;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}
</style>
