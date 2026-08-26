<script setup lang="ts">
// 3. Demande de disponibilité -- LE POINT SENSIBLE (prompt d'extension
// matching/dispo, §3) : ce formulaire COMPOSE le briefing envoyé au
// speaker, qui ne verra JAMAIS la demande client elle-même (frontière
// admin <-> speaker, voir CLAUDE.md §6 availability_requests). L'encart
// d'avertissement ci-dessous est une règle métier centrale du projet --
// elle doit être VISIBLE À L'ÉCRAN, pas seulement dans le code qui copie
// ces champs en colonnes propres côté API.
import { computed, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import InputNumber from 'primevue/inputnumber';
import DatePicker from 'primevue/datepicker';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useTaxonomiesStore } from '../../../stores/taxonomies';
import {
  sendAvailabilityRequest,
  type SendAvailabilityRequestBody,
} from '../../../services/availability-requests';
import { SERVICE_TYPE_LABELS } from '../../../config/booking-status';
import type { BookingRequestDetail } from '../../../services/booking-requests';
import type { BookingRequestSpeaker } from '../../../services/booking-request-speakers';
import type { ApiError } from '../../../lib/api-error';

const props = defineProps<{
  visible: boolean;
  request: BookingRequestDetail;
  speaker: BookingRequestSpeaker;
}>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  sent: [];
}>();

const taxonomies = useTaxonomiesStore();
const toast = useToast();

function todayPlus(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

type FormFields = Omit<
  SendAvailabilityRequestBody,
  'eventDate' | 'eventEndDate' | 'respondDueAt'
>;

// Pré-rempli depuis la demande, TOUT reste modifiable (prompt §3). Jamais
// pré-rempli : proposedFeeAmount -- voir l'encart dédié plus bas, c'est LA
// confusion à éviter (rémunération speaker != budget client).
function buildInitialForm(): FormFields {
  return {
    bookingRequestId: props.request.id,
    speakerId: props.speaker.speaker.id,
    eventType: SERVICE_TYPE_LABELS[props.request.serviceType] ?? props.request.serviceType,
    topic: props.request.primaryTopics ?? '',
    audienceSize: props.request.audienceSize ?? undefined,
    language: props.request.language ?? undefined,
    isVirtual: false,
  };
}

const form = ref<FormFields>(buildInitialForm());
// DatePicker (PrimeVue) travaille en `Date`, l'API en chaîne "YYYY-MM-DD" --
// refs séparées, converties au moment de l'envoi (voir onSubmit).
const eventDate = ref<Date | null>(null);
const eventEndDate = ref<Date | null>(null);
const respondDueAt = ref<Date | null>(null);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      form.value = buildInitialForm();
      eventDate.value = props.request.eventDate
        ? new Date(props.request.eventDate)
        : todayPlus(30);
      eventEndDate.value = null;
      respondDueAt.value = null;
      conflictMessage.value = null;
    }
  },
);

const countryOptions = computed(() =>
  taxonomies.countries.map((c) => ({ value: c.id, label: c.name })),
);

const sending = ref(false);
const conflictMessage = ref<string | null>(null);

function toIsoDate(d: Date | null): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

async function onSubmit(): Promise<void> {
  conflictMessage.value = null;
  sending.value = true;
  try {
    const body: SendAvailabilityRequestBody = {
      ...form.value,
      eventDate: toIsoDate(eventDate.value) ?? toIsoDate(todayPlus(30))!,
      eventEndDate: toIsoDate(eventEndDate.value),
      respondDueAt: respondDueAt.value ? respondDueAt.value.toISOString() : undefined,
    };
    await sendAvailabilityRequest(body);
    emit('sent');
    emit('update:visible', false);
    toast.add({
      severity: 'success',
      summary: 'Sollicitation envoyée',
      detail: `${props.speaker.speaker.displayName} a reçu le briefing par e-mail.`,
      life: 4000,
    });
  } catch (err) {
    const apiError = err as ApiError;
    if (apiError?.statusCode === 409) {
      // §3 -- message clair, pas une erreur brute : réutilise le texte déjà
      // écrit côté API (explique la marche à suivre), affiché ICI en plus
      // du toast global (une notification transitoire ne suffit pas pour
      // une action bloquée qui a besoin d'explication).
      conflictMessage.value =
        apiError.messages[0] ?? 'Une sollicitation est déjà active pour ce speaker.';
    }
  } finally {
    sending.value = false;
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
    header="Demander la disponibilité"
    style="width: 640px"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="request-form">
      <Message severity="warn" :closable="false" class="privacy-notice">
        <strong>{{ speaker.speaker.displayName }} ne verra que ce formulaire.</strong>
        Il ne verra ni l'identité du client, ni le budget annoncé, ni les notes
        internes. Uniquement les informations ci-dessous.
      </Message>

      <Message v-if="conflictMessage" severity="warn" :closable="false">
        {{ conflictMessage }}
      </Message>

      <div class="form-grid">
        <div class="field">
          <label>Type d'événement *</label>
          <InputText v-model="form.eventType" />
        </div>
        <div class="field">
          <label>Sujet *</label>
          <InputText v-model="form.topic" />
        </div>
        <div class="field">
          <label>Date *</label>
          <DatePicker v-model="eventDate" date-format="yy-mm-dd" show-icon />
        </div>
        <div class="field">
          <label>Date de fin (si différente)</label>
          <DatePicker v-model="eventEndDate" date-format="yy-mm-dd" show-icon />
        </div>
        <div class="field field--inline">
          <Checkbox v-model="form.isVirtual" binary input-id="req-virtual" />
          <label for="req-virtual">Événement virtuel</label>
        </div>
        <div class="field">
          <label>Pays (si présentiel)</label>
          <Select
            v-model="form.locationCountryId"
            :options="countryOptions"
            option-label="label"
            option-value="value"
            show-clear
            filter
            :disabled="form.isVirtual"
          />
        </div>
        <div class="field">
          <label>Durée (minutes)</label>
          <InputNumber v-model="form.durationMinutes" :min="1" />
        </div>
        <div class="field">
          <label>Langue</label>
          <InputText v-model="form.language" />
        </div>
        <div class="field">
          <label>Public</label>
          <InputText v-model="form.audienceSize" />
        </div>
        <div class="field">
          <label>Date limite de réponse</label>
          <DatePicker v-model="respondDueAt" date-format="yy-mm-dd" show-icon />
        </div>
      </div>

      <div class="field field--wide">
        <label>Description du public</label>
        <Textarea v-model="form.audienceDescription" rows="2" auto-resize />
      </div>

      <!-- Zone confidentielle : même traitement visuel que la tarification
           speaker ailleurs dans l'app -- distinct du budget client. -->
      <div class="fee-section">
        <h3 class="fee-section__title">
          Rémunération proposée à {{ speaker.speaker.displayName }}
          <span class="confidential-badge">Jamais le budget client</span>
        </h3>
        <div class="form-grid">
          <div class="field">
            <label>Montant</label>
            <InputNumber v-model="form.proposedFeeAmount" mode="decimal" :min="0" />
          </div>
          <div class="field">
            <label>Devise</label>
            <InputText v-model="form.proposedFeeCurrency" placeholder="USD" />
          </div>
        </div>
      </div>

      <div class="field field--wide">
        <label>Conditions de déplacement</label>
        <Textarea v-model="form.travelConditions" rows="2" auto-resize />
      </div>
      <div class="field field--wide">
        <label>Notes additionnelles</label>
        <Textarea v-model="form.additionalNotes" rows="2" auto-resize />
      </div>
    </div>

    <template #footer>
      <Button label="Annuler" text @click="close" />
      <Button
        label="Envoyer la sollicitation"
        :loading="sending"
        :disabled="!form.eventType.trim() || !form.topic.trim() || !eventDate"
        @click="onSubmit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.request-form {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.privacy-notice {
  margin: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--asb-space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.field--wide {
  grid-column: 1 / -1;
}

.field--inline {
  flex-direction: row;
  align-items: center;
  gap: var(--asb-space-2);
}

.field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.fee-section {
  border: 1px solid var(--asb-gold-300);
  background: var(--asb-gold-50);
  padding: var(--asb-space-4);
}

.fee-section__title {
  margin: 0 0 var(--asb-space-3);
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}

.confidential-badge {
  font-family: var(--asb-font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--asb-gold-700);
  border: 1px solid var(--asb-gold-300);
  border-radius: var(--asb-radius-sm);
  padding: 2px 8px;
  margin-left: var(--asb-space-2);
  vertical-align: middle;
}
</style>
