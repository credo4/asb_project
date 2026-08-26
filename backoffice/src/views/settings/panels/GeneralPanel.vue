<script setup lang="ts">
// Paramètres > Général (§A4). Lecture ADMIN, écriture SUPER_ADMIN --
// formulaire désactivé (pas caché) pour un ADMIN, avec infobulle, même
// principe que le reste de cet écran.
import { onMounted, reactive, ref } from 'vue';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../../../stores/auth';
import {
  fetchAppSettings,
  updateAppSettings,
  type UpdateAppSettingsBody,
} from '../../../services/app-settings';
import type { ApiError } from '../../../lib/api-error';

const auth = useAuthStore();
const toast = useToast();
const isSuperAdmin = () => auth.user?.role === 'SUPER_ADMIN';
const RESERVED_TOOLTIP = 'Réservé aux super administrateurs.';

const loading = ref(true);
const loadError = ref<string | null>(null);
const lastUpdated = ref<{ updatedAt: string | null; updatedBy: { email: string } | null }>({
  updatedAt: null,
  updatedBy: null,
});

const form = reactive<Required<UpdateAppSettingsBody>>({
  agencyName: '',
  teamEmail: '',
  responseSlaBusinessDays: 5,
  defaultCurrency: '',
  collaborationTermsVersion: '',
});

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const settings = await fetchAppSettings();
    form.agencyName = settings.agencyName;
    form.teamEmail = settings.teamEmail ?? '';
    form.responseSlaBusinessDays = settings.responseSlaBusinessDays;
    form.defaultCurrency = settings.defaultCurrency;
    form.collaborationTermsVersion = settings.collaborationTermsVersion;
    lastUpdated.value = { updatedAt: settings.updatedAt, updatedBy: settings.updatedBy };
  } catch {
    loadError.value = 'Impossible de charger les paramètres.';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const saving = ref(false);
const errorMessage = ref<string | null>(null);
async function save(): Promise<void> {
  errorMessage.value = null;
  saving.value = true;
  try {
    const settings = await updateAppSettings({ ...form });
    lastUpdated.value = { updatedAt: settings.updatedAt, updatedBy: settings.updatedBy };
    toast.add({ severity: 'success', summary: 'Paramètres enregistrés', life: 3000 });
  } catch (err) {
    const apiError = err as ApiError;
    errorMessage.value =
      apiError?.messages?.[0] ?? "Impossible d'enregistrer les paramètres.";
  } finally {
    saving.value = false;
  }
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('fr-FR') : 'jamais modifié';
}
</script>

<template>
  <div class="general-panel">
    <div v-if="loading" class="general-panel__skeleton">
      <Skeleton height="2rem" />
      <Skeleton height="8rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else>
      <section class="detail-card">
        <div class="detail-card__header">
          <h2 class="detail-card__title">Paramètres généraux</h2>
          <span class="detail-card__meta">
            Dernière modification : {{ formatDateTime(lastUpdated.updatedAt) }}
            <template v-if="lastUpdated.updatedBy"> par {{ lastUpdated.updatedBy.email }}</template>
          </span>
        </div>

        <Message v-if="!isSuperAdmin()" severity="info" :closable="false">
          Lecture seule -- réservé aux super administrateurs pour la modification.
        </Message>
        <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

        <div class="form-grid">
          <div class="field">
            <label for="settings-agency-name">Nom de l'agence</label>
            <InputText
              id="settings-agency-name"
              v-model="form.agencyName"
              :disabled="!isSuperAdmin()"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="settings-team-email">E-mail de l'équipe</label>
            <InputText
              id="settings-team-email"
              v-model="form.teamEmail"
              type="email"
              :disabled="!isSuperAdmin()"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="settings-currency">Devise par défaut</label>
            <InputText
              id="settings-currency"
              v-model="form.defaultCurrency"
              placeholder="USD"
              :disabled="!isSuperAdmin()"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="settings-terms-version">Version des conditions de collaboration</label>
            <InputText
              id="settings-terms-version"
              v-model="form.collaborationTermsVersion"
              :disabled="!isSuperAdmin()"
              class="w-full"
            />
          </div>
        </div>

        <div class="sla-block">
          <div class="field">
            <label for="settings-sla">Délai de réponse SLA (jours ouvrés)</label>
            <InputNumber
              id="settings-sla"
              v-model="form.responseSlaBusinessDays"
              :min="1"
              :max="30"
              :disabled="!isSuperAdmin()"
              show-buttons
              button-layout="horizontal"
              class="w-full"
            />
          </div>
          <Message severity="warn" :closable="false" class="sla-warning">
            S'applique uniquement aux NOUVELLES demandes créées après
            l'enregistrement -- les demandes déjà existantes gardent leur
            délai d'origine, jamais recalculé rétroactivement. Par ailleurs,
            ce réglage ne remplace pas le délai déjà en vigueur par type de
            prestation (conférence, masterclass…) : il ne sert que de repli
            pour un futur type de service qui n'en aurait pas encore un dédié.
          </Message>
        </div>

        <Button
          v-tooltip.top="!isSuperAdmin() ? RESERVED_TOOLTIP : undefined"
          label="Enregistrer"
          :loading="saving"
          :disabled="!isSuperAdmin()"
          @click="save"
        />
      </section>
    </template>
  </div>
</template>

<style scoped>
.general-panel {
  max-width: 720px;
}

.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.detail-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--asb-space-2);
}

.detail-card__title {
  margin: 0;
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.detail-card__meta {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--asb-space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.sla-block {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
  max-width: 320px;
}

.sla-warning {
  margin: 0;
  max-width: 640px;
}

.w-full {
  width: 100%;
}
</style>
