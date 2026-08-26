<script setup lang="ts">
// 2.2 Fiche speaker en lecture + 2.4 Workflow de publication (changement de
// statut, affichage lisible du refus quand des champs manquent).
import { computed, ref, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Avatar from 'primevue/avatar';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import StatusTag from '../../components/StatusTag.vue';
import BackButton from '../../components/BackButton.vue';
import {
  fetchSpeaker,
  updateSpeakerStatus,
  type SpeakerDetail,
} from '../../services/speakers';
import {
  speakerStatusInfo,
  allowedNextStatuses,
  FEE_TIER_LABELS,
} from '../../config/speaker-status';
import type { ApiError } from '../../lib/api-error';

const props = defineProps<{ id: number }>();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

const speaker = ref<SpeakerDetail | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    speaker.value = await fetchSpeaker(props.id);
  } catch {
    loadError.value = "Impossible de charger ce speaker.";
  } finally {
    loading.value = false;
  }
}
watchEffect(() => {
  void load();
});

const nextStatus = ref<string | null>(null);
const statusUpdating = ref(false);
const publishRefusalReasons = ref<string[] | null>(null);
const statusErrorMessage = ref<string | null>(null);

const nextStatusOptions = computed(() => {
  if (!speaker.value) return [];
  return allowedNextStatuses(speaker.value.status).map((s) => ({
    value: s,
    label: speakerStatusInfo(s).label,
  }));
});

function parsePublishRefusal(message: string): string[] | null {
  const marker = 'champs manquants : ';
  const idx = message.indexOf(marker);
  if (idx === -1) return null;
  const rest = message.slice(idx + marker.length).replace(/\.$/, '');
  return rest
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function applyStatusChange(): Promise<void> {
  if (!speaker.value || !nextStatus.value) return;
  publishRefusalReasons.value = null;
  statusErrorMessage.value = null;
  statusUpdating.value = true;
  try {
    speaker.value = await updateSpeakerStatus(speaker.value.id, {
      status: nextStatus.value as SpeakerDetail['status'],
    });
    nextStatus.value = null;
    toast.add({ severity: 'success', summary: 'Statut mis à jour', life: 3000 });
  } catch (err) {
    const apiError = err as ApiError;
    const message = apiError?.messages?.[0];
    if (message) {
      const missing = parsePublishRefusal(message);
      if (missing) {
        publishRefusalReasons.value = missing;
      } else {
        statusErrorMessage.value = message;
      }
    }
  } finally {
    statusUpdating.value = false;
  }
}

function confirmStatusChange(): void {
  if (!nextStatus.value) return;
  confirm.require({
    message: `Confirmer le passage au statut « ${speakerStatusInfo(nextStatus.value).label} » ?`,
    header: 'Changement de statut',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Confirmer',
    rejectLabel: 'Annuler',
    accept: () => void applyStatusChange(),
  });
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
</script>

<template>
  <div class="detail">
    <div v-if="loading" class="detail__skeleton">
      <Skeleton height="2rem" width="18rem" />
      <Skeleton height="10rem" />
      <Skeleton height="10rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else-if="speaker">
      <div class="detail__header">
        <BackButton :to="{ name: 'speakers-list' }" label="Speakers" />
        <div class="detail__title-row">
          <Avatar
            v-if="speaker.profilePhotoUrl"
            :image="speaker.profilePhotoUrl"
            size="xlarge"
            shape="circle"
          />
          <Avatar
            v-else
            :label="initials(speaker.publicName || `${speaker.firstName} ${speaker.lastName}`)"
            size="xlarge"
            shape="circle"
          />
          <div>
            <h1 class="detail__name">
              {{ speaker.publicName || `${speaker.firstName} ${speaker.lastName}` }}
            </h1>
            <p v-if="speaker.professionalTitle" class="detail__subtitle">
              {{ speaker.professionalTitle }}
              <span v-if="speaker.currentOrganization"
                >· {{ speaker.currentOrganization }}</span
              >
            </p>
          </div>
          <span class="detail__spacer" />
          <StatusTag
            :label="speakerStatusInfo(speaker.status).label"
            :family="speakerStatusInfo(speaker.status).family"
          />
          <StatusTag
            v-if="speaker.isFeaturedHome"
            label="Mis en avant"
            family="gold"
          />
          <StatusTag
            v-if="speaker.isTopRequested"
            label="Très demandé"
            family="gold"
          />
          <Button
            label="Modifier"
            icon="pi pi-pencil"
            severity="secondary"
            outlined
            @click="router.push({ name: 'speakers-edit', params: { id: speaker.id } })"
          />
        </div>
      </div>

      <!-- 2.4 Workflow de publication -->
      <section class="detail-card">
        <h2 class="detail-card__title">Statut</h2>
        <div class="status-row">
          <span class="status-row__current"
            >Actuel :
            <StatusTag
              :label="speakerStatusInfo(speaker.status).label"
              :family="speakerStatusInfo(speaker.status).family"
          /></span>
          <Select
            v-model="nextStatus"
            :options="nextStatusOptions"
            option-label="label"
            option-value="value"
            placeholder="Changer le statut…"
            :disabled="nextStatusOptions.length === 0"
          />
          <Button
            label="Appliquer"
            size="small"
            :loading="statusUpdating"
            :disabled="!nextStatus"
            @click="confirmStatusChange"
          />
        </div>
        <p v-if="nextStatusOptions.length === 0" class="detail-card__hint">
          Aucune transition disponible depuis ce statut (terminal, ou
          réouverture réservée à une action dédiée).
        </p>

        <Message v-if="publishRefusalReasons" severity="warn" class="publish-refusal">
          <strong>Publication impossible — champs manquants :</strong>
          <ul>
            <li v-for="reason in publishRefusalReasons" :key="reason">
              {{ reason }}
            </li>
          </ul>
        </Message>
        <Message v-if="statusErrorMessage" severity="error">{{
          statusErrorMessage
        }}</Message>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Informations générales</h2>
        <dl class="detail-grid">
          <div><dt>Civilité</dt><dd>{{ speaker.civility ?? '—' }}</dd></div>
          <div><dt>Prénom / Nom</dt><dd>{{ speaker.firstName }} {{ speaker.lastName }}</dd></div>
          <div><dt>E-mail</dt><dd>{{ speaker.email ?? '—' }}</dd></div>
          <div><dt>Téléphone</dt><dd>{{ speaker.phone ?? '—' }}</dd></div>
          <div><dt>Pays de résidence</dt><dd>{{ speaker.country?.name ?? '—' }}</dd></div>
          <div><dt>Nationalité</dt><dd>{{ speaker.nationality?.name ?? '—' }}</dd></div>
          <div><dt>Ville</dt><dd>{{ speaker.city ?? '—' }}</dd></div>
          <div><dt>Fuseau horaire</dt><dd>{{ speaker.timezone ?? '—' }}</dd></div>
          <div><dt>Slug</dt><dd>{{ speaker.slug ?? '—' }}</dd></div>
        </dl>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Présentation publique</h2>
        <dl class="detail-grid detail-grid--wide">
          <div><dt>Bio courte</dt><dd>{{ speaker.shortBio ?? '—' }}</dd></div>
          <div><dt>Bio complète</dt><dd class="detail-grid__pre">{{ speaker.fullBio ?? '—' }}</dd></div>
          <div><dt>Citation</dt><dd>{{ speaker.quote ?? '—' }}</dd></div>
        </dl>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Expertise</h2>
        <dl class="detail-grid detail-grid--wide">
          <div>
            <dt>Piliers</dt>
            <dd>
              <span v-if="speaker.pillars.length === 0">—</span>
              <StatusTag
                v-for="p in speaker.pillars"
                :key="p.pillar.id"
                :label="p.pillar.name + (p.isPrimary ? ' (principal)' : '')"
                family="info"
              />
            </dd>
          </div>
          <div>
            <dt>Thèmes</dt>
            <dd>{{ speaker.themes.map((t) => t.name).join(', ') || '—' }}</dd>
          </div>
          <div>
            <dt>Mots-clés</dt>
            <dd>{{ speaker.keywords.join(', ') || '—' }}</dd>
          </div>
        </dl>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Formats & langues</h2>
        <dl class="detail-grid detail-grid--wide">
          <div>
            <dt>Formats</dt>
            <dd>{{ speaker.formats.map((f) => f.name).join(', ') || '—' }}</dd>
          </div>
          <div>
            <dt>Langues</dt>
            <dd>
              {{
                speaker.languages
                  .map((l) => `${l.language.name} (${l.proficiency})`)
                  .join(', ') || '—'
              }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- Zone confidentielle -->
      <section class="detail-card detail-card--confidential">
        <h2 class="detail-card__title">
          Tarification <span class="confidential-badge">Confidentiel</span>
        </h2>
        <dl v-if="speaker.pricing" class="detail-grid">
          <div><dt>Devise</dt><dd>{{ speaker.pricing.currency }}</dd></div>
          <div><dt>Min.</dt><dd>{{ speaker.pricing.minFee ?? '—' }}</dd></div>
          <div><dt>Recommandé</dt><dd>{{ speaker.pricing.recommendedFee ?? '—' }}</dd></div>
          <div><dt>Keynote</dt><dd>{{ speaker.pricing.feeKeynote ?? '—' }}</dd></div>
          <div><dt>Panel</dt><dd>{{ speaker.pricing.feePanel ?? '—' }}</dd></div>
          <div><dt>Webinar</dt><dd>{{ speaker.pricing.feeWebinar ?? '—' }}</dd></div>
          <div><dt>Masterclass</dt><dd>{{ speaker.pricing.feeMasterclass ?? '—' }}</dd></div>
          <div><dt>Commission agence</dt><dd>{{ speaker.pricing.agencyCommission ?? '—' }}</dd></div>
          <div>
            <dt>Niveau public</dt>
            <dd>{{ speaker.feeTierPublic ? FEE_TIER_LABELS[speaker.feeTierPublic] : '—' }}</dd>
          </div>
        </dl>
        <p v-else class="detail-card__hint">Aucune tarification renseignée.</p>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Engagements signature</h2>
        <ul v-if="speaker.engagements.length > 0" class="engagement-list">
          <li v-for="e in speaker.engagements" :key="e.id">
            <strong>{{ e.eventName }}</strong>
            <span v-if="e.organization"> — {{ e.organization }}</span>
            <span v-if="e.dateLabel"> ({{ e.dateLabel }})</span>
          </li>
        </ul>
        <p v-else class="detail-card__hint">Aucun engagement renseigné.</p>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Médias</h2>
        <div v-if="speaker.media.length > 0" class="media-grid">
          <div v-for="m in speaker.media" :key="m.id" class="media-item">
            <img
              v-if="m.type === 'PHOTO'"
              :src="m.thumbnailUrl ?? m.url"
              :alt="m.title ?? ''"
            />
            <span v-else class="media-item__type">{{ m.type }}</span>
            <StatusTag
              :label="m.status"
              :family="m.status === 'APPROVED' ? 'success' : m.status === 'REJECTED' ? 'danger' : 'warn'"
            />
          </div>
        </div>
        <p v-else class="detail-card__hint">Aucun média.</p>
      </section>

      <section class="detail-card">
        <h2 class="detail-card__title">Visibilité</h2>
        <dl class="detail-grid">
          <div><dt>Afficher le budget</dt><dd>{{ speaker.showBudget ? 'Oui' : 'Non' }}</dd></div>
          <div><dt>Afficher la localisation</dt><dd>{{ speaker.showLocation ? 'Oui' : 'Non' }}</dd></div>
          <div><dt>Indexable</dt><dd>{{ speaker.allowIndexing ? 'Oui' : 'Non' }}</dd></div>
          <div><dt>Complétion</dt><dd>{{ speaker.completionScore }} %</dd></div>
        </dl>
      </section>
    </template>
  </div>
</template>

<style scoped>
.detail {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.detail__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}


.detail__title-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  margin-top: var(--asb-space-2);
  flex-wrap: wrap;
}

.detail__name {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.detail__subtitle {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.detail__spacer {
  flex: 1;
}

.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
}

.detail-card--confidential {
  border-color: var(--asb-gold-300);
  background: var(--asb-gold-50);
}

.confidential-badge {
  font-family: var(--asb-font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--asb-gold-700);
  border: 1px solid var(--asb-gold-300);
  border-radius: var(--asb-radius-sm);
  padding: 2px 8px;
  margin-left: var(--asb-space-2);
  vertical-align: middle;
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

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--asb-space-4);
  margin: 0;
}

.detail-grid--wide {
  grid-template-columns: 1fr;
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
  font-size: var(--asb-text-base);
  color: var(--asb-text);
}

.detail-grid__pre {
  white-space: pre-wrap;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  flex-wrap: wrap;
}

.status-row__current {
  display: inline-flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.publish-refusal ul {
  margin: var(--asb-space-2) 0 0;
  padding-left: 18px;
}

.engagement-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--asb-space-3);
}

.media-item {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
  align-items: center;
}

.media-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid var(--asb-border);
}

.media-item__type {
  font-family: var(--asb-font-mono);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}
</style>
