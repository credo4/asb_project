<script setup lang="ts">
// 3. Détail d'une mission.
import { computed, ref, watchEffect } from 'vue';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import Timeline from 'primevue/timeline';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Avatar from 'primevue/avatar';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import StatusTag from '../../components/StatusTag.vue';
import BackButton from '../../components/BackButton.vue';
import MissionChecklistCard from './components/MissionChecklistCard.vue';
import MissionDocumentsCard from './components/MissionDocumentsCard.vue';
import MissionMessagesCard from './components/MissionMessagesCard.vue';
import { useAuthStore } from '../../stores/auth';
import {
  fetchMission,
  fetchMissionHistory,
  updateMissionStatus,
  type MissionDetail,
  type MissionHistoryEntry,
} from '../../services/missions';
import {
  missionStatusInfo,
  missionContractStatusInfo,
  missionPaymentStatusInfo,
  missionLogisticsStatusInfo,
  allowedNextMissionStatuses,
  TERMINAL_MISSION_STATUSES,
} from '../../config/mission-status';
import { SERVICE_TYPE_LABELS } from '../../config/booking-status';
import type { ApiError } from '../../lib/api-error';

const props = defineProps<{ id: number }>();
const auth = useAuthStore();
const confirm = useConfirm();
const toast = useToast();

const mission = ref<MissionDetail | null>(null);
const history = ref<MissionHistoryEntry[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [detail, historyEntries] = await Promise.all([
      fetchMission(props.id),
      fetchMissionHistory(props.id),
    ]);
    mission.value = detail;
    history.value = historyEntries;
  } catch {
    loadError.value = 'Impossible de charger cette mission.';
  } finally {
    loading.value = false;
  }
}
watchEffect(() => {
  void load();
});
async function refreshHistory(): Promise<void> {
  history.value = await fetchMissionHistory(props.id);
}
async function onSubEntityChanged(): Promise<void> {
  if (!mission.value) return;
  mission.value = await fetchMission(mission.value.id);
  await refreshHistory();
}

const isSuperAdmin = computed(() => auth.user?.role === 'SUPER_ADMIN');
const isTerminal = computed(
  () => mission.value !== null && TERMINAL_MISSION_STATUSES.includes(mission.value.status),
);
const nextStatus = ref<string | null>(null);
const cancellationReason = ref('');
const nextStatusOptions = computed(() => {
  if (!mission.value) return [];
  return allowedNextMissionStatuses(mission.value.status, isSuperAdmin.value).map((s) => ({
    value: s,
    label: missionStatusInfo(s).label,
  }));
});
const isBackwardJump = computed(() => {
  if (!mission.value || !nextStatus.value) return false;
  // Un saut EN ARRIÈRE (réservé SUPER_ADMIN) n'est jamais dans les
  // transitions "en avant" -- voir allowedNextMissionStatuses côté config,
  // qui inclut les deux catégories seulement pour SUPER_ADMIN.
  const forwardOnly = allowedNextMissionStatuses(mission.value.status, false);
  return !forwardOnly.includes(nextStatus.value) && nextStatus.value !== 'CANCELLED';
});

const statusUpdating = ref(false);
const statusErrorMessage = ref<string | null>(null);

async function applyStatusChange(): Promise<void> {
  if (!mission.value || !nextStatus.value) return;
  statusErrorMessage.value = null;
  statusUpdating.value = true;
  try {
    mission.value = await updateMissionStatus(mission.value.id, {
      status: nextStatus.value as MissionDetail['status'],
      cancellationReason:
        nextStatus.value === 'CANCELLED' ? cancellationReason.value : undefined,
    });
    nextStatus.value = null;
    cancellationReason.value = '';
    await refreshHistory();
    toast.add({ severity: 'success', summary: 'Statut mis à jour', life: 3000 });
  } catch (err) {
    // §3.2 -- l'API liste déjà les options valides dans son message
    // ("Transitions possibles depuis... : ..."), affiché tel quel plutôt
    // que reconstruit : c'est LA liste des options valides qu'elle renvoie.
    statusErrorMessage.value = (err as ApiError)?.messages?.[0] ?? 'Erreur.';
  } finally {
    statusUpdating.value = false;
  }
}
function confirmStatusChange(): void {
  if (!nextStatus.value) return;
  if (nextStatus.value === 'CANCELLED' && !cancellationReason.value.trim()) return;
  confirm.require({
    message: `Confirmer le passage au statut « ${missionStatusInfo(nextStatus.value).label} » ?`,
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
function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}
function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—';
}
</script>

<template>
  <div class="mission-detail">
    <div v-if="loading" class="mission-detail__skeleton">
      <Skeleton height="2rem" width="18rem" />
      <Skeleton height="12rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else-if="mission">
      <BackButton :to="{ name: 'missions-list' }" label="Missions" />

      <div class="mission-detail__header">
        <Avatar
          v-if="mission.speaker.profilePhotoUrl"
          :image="mission.speaker.profilePhotoUrl"
          size="xlarge"
          shape="circle"
        />
        <Avatar v-else :label="initials(mission.speaker.displayName)" size="xlarge" shape="circle" />
        <div class="mission-detail__identity">
          <h1 class="mission-detail__title">{{ mission.reference }}</h1>
          <p class="mission-detail__subtitle">
            {{ mission.speaker.displayName }} · {{ mission.bookingRequest.reference }}
            <span v-if="mission.organization"> · {{ mission.organization.name }}</span>
          </p>
        </div>
        <span class="mission-detail__spacer" />
        <!-- 3.1 -- statut principal PROÉMINENT, sous-statuts discrets et
             regroupés séparément (voir .sub-status-group ci-dessous). -->
        <StatusTag
          :label="missionStatusInfo(mission.status).label"
          :family="missionStatusInfo(mission.status).family"
          class="mission-detail__main-status"
        />
      </div>

      <div class="sub-status-group">
        <span class="sub-status-group__label">Contrat</span>
        <StatusTag
          :label="missionContractStatusInfo(mission.contractStatus).label"
          :family="missionContractStatusInfo(mission.contractStatus).family"
        />
        <span class="sub-status-group__label">Paiement</span>
        <StatusTag
          :label="missionPaymentStatusInfo(mission.paymentStatus).label"
          :family="missionPaymentStatusInfo(mission.paymentStatus).family"
        />
        <span class="sub-status-group__label">Logistique</span>
        <StatusTag
          :label="missionLogisticsStatusInfo(mission.logisticsStatus).label"
          :family="missionLogisticsStatusInfo(mission.logisticsStatus).family"
        />
      </div>

      <!-- 3.2 -- changement de statut : ne propose QUE les transitions
           plausibles, jamais un choix qui échouerait à coup sûr. -->
      <section class="detail-card">
        <h2 class="detail-card__title">Statut</h2>
        <Message severity="info" :closable="false" class="jump-hint">
          Les sauts en avant sont libres (une étape qui ne s'applique pas à
          cette mission peut être passée) — c'est voulu, pas un bug. Les
          retours en arrière sont réservés SUPER_ADMIN.
        </Message>
        <div class="status-row">
          <Select
            v-model="nextStatus"
            :options="nextStatusOptions"
            option-label="label"
            option-value="value"
            placeholder="Changer le statut…"
            :disabled="isTerminal"
          />
          <Button
            label="Appliquer"
            size="small"
            :loading="statusUpdating"
            :disabled="!nextStatus || (nextStatus === 'CANCELLED' && !cancellationReason.trim())"
            @click="confirmStatusChange"
          />
        </div>
        <Message v-if="isBackwardJump" severity="warn" :closable="false" class="jump-hint">
          Ceci est un retour en arrière — réservé SUPER_ADMIN, sera journalisé.
        </Message>
        <div v-if="nextStatus === 'CANCELLED'" class="field">
          <label>Motif d'annulation *</label>
          <Textarea v-model="cancellationReason" rows="2" auto-resize class="w-full" />
        </div>
        <Message v-if="statusErrorMessage" severity="error" :closable="false">{{
          statusErrorMessage
        }}</Message>
        <p v-if="isTerminal" class="detail-card__hint">
          Statut terminal — aucune transition possible.
        </p>
      </section>

      <Tabs value="apercu">
        <TabList>
          <Tab value="apercu">Aperçu</Tab>
          <Tab value="historique">Historique</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="apercu">
            <div class="mission-detail__sections">
              <section class="detail-card">
                <h2 class="detail-card__title">Informations</h2>
                <dl class="detail-grid">
                  <div><dt>Prestation</dt><dd>{{ SERVICE_TYPE_LABELS[mission.serviceType] ?? mission.serviceType }}</dd></div>
                  <div><dt>Date</dt><dd>{{ formatDate(mission.eventDate) }}</dd></div>
                  <div><dt>Horaires</dt><dd>{{ mission.startTime ?? '—' }} – {{ mission.endTime ?? '—' }}</dd></div>
                  <div><dt>Fuseau</dt><dd>{{ mission.timezone ?? '—' }}</dd></div>
                  <div><dt>Lieu</dt><dd>{{ mission.isVirtual ? 'Distanciel' : (mission.locationCountryName ?? '—') }}</dd></div>
                  <div v-if="mission.isVirtual"><dt>Lien</dt><dd>{{ mission.virtualLink ?? '—' }}</dd></div>
                  <div><dt>Contact sur place</dt><dd>{{ mission.onSiteContactName ?? '—' }} {{ mission.onSiteContactPhone ? `(${mission.onSiteContactPhone})` : '' }}</dd></div>
                  <div><dt>Durée</dt><dd>{{ mission.durationMinutes ? `${mission.durationMinutes} min` : '—' }}</dd></div>
                  <div><dt>Langue</dt><dd>{{ mission.language ?? '—' }}</dd></div>
                  <div><dt>Format</dt><dd>{{ mission.format ?? '—' }}</dd></div>
                  <div><dt>Participants</dt><dd>{{ mission.participantCount ?? '—' }}</dd></div>
                </dl>
                <dl class="detail-grid detail-grid--wide">
                  <div><dt>Adresse</dt><dd>{{ mission.address ?? '—' }}</dd></div>
                  <div><dt>Sujet</dt><dd>{{ mission.topic }}</dd></div>
                  <div v-if="mission.internalNotes"><dt>Notes internes</dt><dd>{{ mission.internalNotes }}</dd></div>
                </dl>
              </section>

              <!-- 3.4 -- bloc financier, VISUELLEMENT DISTINCT, marqué
                   confidentiel : le speaker ne voit jamais ça. -->
              <section class="detail-card detail-card--confidential">
                <h2 class="detail-card__title">
                  Financier <span class="confidential-badge">Confidentiel — jamais visible du speaker</span>
                </h2>
                <dl class="detail-grid">
                  <div><dt>Montant client</dt><dd>{{ mission.clientAmount ?? '—' }} {{ mission.currency }}</dd></div>
                  <div><dt>Montant speaker</dt><dd>{{ mission.speakerAmount ?? '—' }} {{ mission.currency }}</dd></div>
                  <div><dt>Commission agence</dt><dd>{{ mission.agencyCommission ?? '—' }} {{ mission.currency }}</dd></div>
                  <div><dt>Frais</dt><dd>{{ mission.expenses ?? '—' }} {{ mission.currency }}</dd></div>
                </dl>
              </section>

              <MissionChecklistCard
                :mission-id="mission.id"
                :items="mission.checklist"
                :progress="mission.checklistProgressPercent"
                @changed="onSubEntityChanged"
              />

              <MissionDocumentsCard
                :mission-id="mission.id"
                :documents="mission.documents"
                @changed="onSubEntityChanged"
              />

              <MissionMessagesCard
                :mission-id="mission.id"
                :messages="mission.messages"
                @changed="onSubEntityChanged"
              />
            </div>
          </TabPanel>

          <TabPanel value="historique">
            <section class="detail-card">
              <Timeline :value="history">
                <template #content="{ item }: { item: MissionHistoryEntry }">
                  <div class="history-item">
                    <strong>{{ item.action }}</strong>
                    <span class="history-item__meta">
                      {{ item.actor ? (item.actor.firstName ?? item.actor.email) : 'Système' }} ·
                      {{ formatDateTime(item.createdAt as unknown as string) }}
                    </span>
                  </div>
                </template>
              </Timeline>
              <p v-if="history.length === 0" class="detail-card__hint">Aucun historique.</p>
            </section>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </div>
</template>

<style scoped>
.mission-detail {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.mission-detail__header {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  flex-wrap: wrap;
}

.mission-detail__identity {
  display: flex;
  flex-direction: column;
}

.mission-detail__title {
  margin: 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.mission-detail__subtitle {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.mission-detail__spacer {
  flex: 1;
}

.mission-detail__main-status :deep(.p-tag) {
  font-size: 14px;
  padding: 6px 14px;
}

.sub-status-group {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  flex-wrap: wrap;
  padding: var(--asb-space-2) var(--asb-space-3);
  background: var(--asb-surface-sunken);
  font-size: var(--asb-text-sm);
}

.sub-status-group__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--asb-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
  letter-spacing: 0.06em;
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

.jump-hint {
  margin: 0 0 var(--asb-space-3);
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  flex-wrap: wrap;
  margin-bottom: var(--asb-space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
  margin-bottom: var(--asb-space-3);
}

.field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.w-full {
  width: 100%;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--asb-space-4);
  margin: 0;
}

.detail-grid--wide {
  grid-template-columns: 1fr;
  margin-top: var(--asb-space-4);
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
  white-space: pre-wrap;
}

.mission-detail__sections {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
  margin-top: var(--asb-space-4);
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-item__meta {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}
</style>
