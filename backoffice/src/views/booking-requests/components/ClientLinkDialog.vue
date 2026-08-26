<script setup lang="ts">
// 4. Rattachement CRM (module Clients, ligne 5.12 -- "la partie utile").
// Rattache la demande à une fiche Contact/Organization EXISTANTE, ou en
// crée une à partir des données d'intake -- SANS jamais les modifier (voir
// CLAUDE.md §5 : "données d'intake IMMUABLES vs fiches CRM"). Le rappel
// visuel de cette frontière est en bas du formulaire, pas juste dans un
// commentaire de code.
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import SelectButton from 'primevue/selectbutton';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import {
  linkBookingRequest,
  type BookingRequestDetail,
} from '../../../services/booking-requests';
import { suggestOrganizations, type OrganizationSuggestion } from '../../../services/organizations';
import { searchContacts, type ContactListItem } from '../../../services/contacts';
import type { ApiError } from '../../../lib/api-error';

const props = defineProps<{ visible: boolean; request: BookingRequestDetail }>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  linked: [request: BookingRequestDetail];
}>();

const toast = useToast();

type LinkMode = 'none' | 'existing' | 'create';
const modeOptions = [
  { value: 'none', label: 'Ne pas rattacher' },
  { value: 'existing', label: 'Fiche existante' },
  { value: 'create', label: 'Créer depuis le formulaire' },
];

const orgMode = ref<LinkMode>('none');
const orgSelected = ref<OrganizationSuggestion | null>(null);
const orgQuery = ref('');
const orgSuggestions = ref<OrganizationSuggestion[]>([]);

const contactMode = ref<LinkMode>('none');
const contactSelected = ref<ContactListItem | null>(null);
const contactQuery = ref('');
const contactSuggestions = ref<ContactListItem[]>([]);

const submitting = ref(false);
const errorMessage = ref<string | null>(null);

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    orgMode.value = 'none';
    orgSelected.value = null;
    orgQuery.value = '';
    orgSuggestions.value = [];
    contactMode.value = 'none';
    contactSelected.value = null;
    contactQuery.value = '';
    contactSuggestions.value = [];
    errorMessage.value = null;
    // Pré-charge des suggestions par similarité dès l'ouverture (évite les
    // doublons de saisie) : l'organisation du formulaire sert de requête.
    if (props.request.organization.trim()) {
      void suggestOrganizations(props.request.organization).then((r) => {
        orgSuggestions.value = r;
      });
    }
  },
);

async function searchOrgs(event: AutoCompleteCompleteEvent): Promise<void> {
  orgSuggestions.value = await suggestOrganizations(event.query);
}
async function searchContactsHandler(event: AutoCompleteCompleteEvent): Promise<void> {
  contactSuggestions.value = await searchContacts(event.query);
}

function contactLabel(c: ContactListItem): string {
  return `${c.firstName} ${c.lastName} <${c.email}>`;
}

const canSubmit = () =>
  (orgMode.value === 'existing' && !!orgSelected.value) ||
  (orgMode.value === 'create' && !!props.request.organization.trim()) ||
  (contactMode.value === 'existing' && !!contactSelected.value) ||
  contactMode.value === 'create';

async function onSubmit(): Promise<void> {
  errorMessage.value = null;
  submitting.value = true;
  try {
    const updated = await linkBookingRequest(props.request.id, {
      organizationId: orgMode.value === 'existing' ? orgSelected.value?.id : undefined,
      createOrganizationFromIntake: orgMode.value === 'create' ? true : undefined,
      contactId: contactMode.value === 'existing' ? contactSelected.value?.id : undefined,
      createContactFromIntake: contactMode.value === 'create' ? true : undefined,
    });
    emit('linked', updated);
    emit('update:visible', false);
    toast.add({ severity: 'success', summary: 'Client rattaché', life: 3000 });
  } catch (err) {
    const apiError = err as ApiError;
    errorMessage.value = apiError?.messages?.[0] ?? 'Impossible de rattacher ce client.';
  } finally {
    submitting.value = false;
  }
}

function close(): void {
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Rattacher un client"
    style="width: 640px"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="link-form">
      <Message severity="info" :closable="false">
        Les données soumises par le prospect (ci-dessus, section « Client »)
        <strong>ne seront jamais modifiées</strong>. Le rattachement crée ou
        relie une fiche CRM séparée, distincte de cette trace d'origine.
      </Message>

      <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

      <section class="link-section">
        <h3 class="link-section__title">Organisation</h3>
        <SelectButton
          v-model="orgMode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
        />

        <div v-if="orgMode === 'existing'" class="link-section__field">
          <AutoComplete
            v-model="orgQuery"
            :suggestions="orgSuggestions"
            option-label="name"
            placeholder="Rechercher une organisation…"
            class="w-full"
            @complete="searchOrgs"
            @item-select="(e) => (orgSelected = e.value as OrganizationSuggestion)"
          />
        </div>

        <div v-else-if="orgMode === 'create'" class="link-section__field">
          <p v-if="request.organization.trim()" class="create-preview">
            Sera créée : « {{ request.organization }} »
          </p>
          <Message v-else severity="warn" :closable="false" size="small">
            Le champ « Organisation » du formulaire est vide -- impossible de créer une fiche.
          </Message>
          <p v-if="orgSuggestions.length > 0" class="dedup-hint">
            Organisations similaires déjà connues : {{ orgSuggestions.map((o) => o.name).join(', ') }}
            -- vérifie qu'il ne s'agit pas d'un doublon avant de créer.
          </p>
        </div>
      </section>

      <section class="link-section">
        <h3 class="link-section__title">Contact</h3>
        <SelectButton
          v-model="contactMode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
        />

        <div v-if="contactMode === 'existing'" class="link-section__field">
          <AutoComplete
            v-model="contactQuery"
            :suggestions="contactSuggestions"
            :option-label="contactLabel"
            placeholder="Rechercher par nom ou e-mail…"
            class="w-full"
            @complete="searchContactsHandler"
            @item-select="(e) => (contactSelected = e.value as ContactListItem)"
          />
        </div>

        <div v-else-if="contactMode === 'create'" class="link-section__field">
          <p class="create-preview">
            Sera créé : « {{ request.fullName }} » &lt;{{ request.workEmail }}&gt;
          </p>
        </div>
      </section>
    </div>

    <template #footer>
      <Button label="Annuler" text @click="close" />
      <Button
        label="Rattacher"
        :loading="submitting"
        :disabled="!canSubmit()"
        @click="onSubmit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.link-form {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.link-section {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
  padding: var(--asb-space-3);
  border: 1px solid var(--asb-border);
}

.link-section__title {
  margin: 0;
  font-size: var(--asb-text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--asb-text-muted);
}

.link-section__field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.create-preview {
  margin: 0;
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.dedup-hint {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-gold-700);
}

.w-full {
  width: 100%;
}
</style>
