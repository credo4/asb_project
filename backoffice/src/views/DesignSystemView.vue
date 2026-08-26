<script setup lang="ts">
// Page de référence visuelle (prompt §1.2) : boutons, champs, badges,
// tableau, états vides et squelettes — vérifie que tokens.css + le preset
// PrimeVue (voir theme/asb-preset.ts) sont bien appliqués. Retirée avant
// mise en production (jamais liée depuis le menu, voir router/index.ts).
import { ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import MultiSelect from 'primevue/multiselect';
import Checkbox from 'primevue/checkbox';
import ToggleSwitch from 'primevue/toggleswitch';
import Tag from 'primevue/tag';
import Avatar from 'primevue/avatar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';

const country = ref('Kenya');
const countries = ['Kenya', 'Nigeria', 'Sénégal', 'Afrique du Sud'];
const pillars = ref(['Gouvernance']);
const pillarOptions = ['Gouvernance', 'Climat', 'Économie', 'Innovation'];
const featured = ref(true);
const compactTable = ref(false);

const speakers = [
  {
    name: 'Amara Osei',
    title: 'Development economist',
    country: 'Kenya',
    tier: 'T4',
    status: 'Publié',
    severity: 'success',
  },
  {
    name: 'Kwame Owusu',
    title: 'Fintech founder',
    country: 'Ghana',
    tier: 'T3',
    status: 'À valider',
    severity: 'warn',
  },
  {
    name: 'Ifeoma Adeneye',
    title: 'Trade negotiator',
    country: 'Nigeria',
    tier: 'T5',
    status: 'Mis en avant',
    severity: 'gold',
  },
  {
    name: 'Thandiwe Dlamini',
    title: 'Climate policy lead',
    country: 'Afrique du Sud',
    tier: 'T2',
    status: 'Incomplet',
    severity: 'neutral',
  },
];

// Les 6 familles sémantiques de badges (voir charte, section 05) : la
// couleur indique la FAMILLE (donc l'action attendue), le libellé porte le
// détail métier. La correspondance statut → famille pour chaque cycle de
// vie (demande client, mission, speaker, candidature) est du contenu métier
// — elle viendra phase par phase, pas ici.
const badgeFamilies: { label: string; severity: string }[] = [
  { label: 'Neutre — terminal', severity: 'neutral' },
  { label: 'Avertissement — en attente', severity: 'warn' },
  { label: 'Information — en cours', severity: 'info' },
  { label: 'Succès — positif', severity: 'success' },
  { label: 'Erreur — négatif', severity: 'danger' },
  { label: 'Marque — distinction', severity: 'gold' },
];
</script>

<template>
  <div class="ds">
    <header class="ds__header">
      <span class="ds__kicker">Africa Speakers Bureau — Interfaces privées</span>
      <h1 class="ds__title">Référence visuelle</h1>
      <p class="ds__lede">
        Page de développement uniquement — vérifie que <code>tokens.css</code>
        et le preset PrimeVue sont bien appliqués. Supprimée avant mise en
        production.
      </p>
    </header>

    <!-- Boutons -->
    <section class="ds-section">
      <h2 class="ds-section__title">Boutons</h2>
      <div class="ds-card">
        <div class="ds-row">
          <Button label="Valider le profil" />
          <Button label="Demander une correction" severity="secondary" outlined />
          <Button label="Annuler" text />
          <Button label="Archiver" severity="danger" />
        </div>
        <div class="ds-row">
          <Button label="sm" size="small" severity="secondary" outlined />
          <Button label="md" severity="secondary" outlined />
          <Button label="lg" size="large" severity="secondary" outlined />
          <Button label="Chargement" loading />
          <Button label="Désactivé" disabled />
        </div>
      </div>
    </section>

    <!-- Champs -->
    <section class="ds-section">
      <h2 class="ds-section__title">Champs de saisie</h2>
      <div class="ds-card ds-card--form">
        <div class="field">
          <label for="ds-name">Nom complet *</label>
          <InputText id="ds-name" model-value="Amara Osei" />
          <span class="field__hint"
            >Tel qu'il apparaîtra sur la fiche publique.</span
          >
        </div>
        <div class="field">
          <label for="ds-country">Pays</label>
          <Select
            id="ds-country"
            v-model="country"
            :options="countries"
            class="w-full"
          />
        </div>
        <div class="field">
          <label for="ds-pillars">Piliers</label>
          <MultiSelect
            id="ds-pillars"
            v-model="pillars"
            :options="pillarOptions"
            class="w-full"
          />
        </div>
        <div class="field">
          <label for="ds-email">Adresse e-mail</label>
          <InputText id="ds-email" model-value="amara.osei@" invalid />
          <Message severity="error" variant="simple" size="small"
            >Format d'adresse invalide.</Message
          >
        </div>
        <div class="field field--wide">
          <label for="ds-bio">Biographie courte</label>
          <Textarea
            id="ds-bio"
            rows="3"
            model-value="Development economist and three-time TED Global speaker."
          />
        </div>
        <div class="ds-row ds-row--controls">
          <div class="control">
            <Checkbox v-model="featured" binary input-id="ds-check" />
            <label for="ds-check">Mis en avant sur la page d'accueil</label>
          </div>
          <div class="control">
            <ToggleSwitch v-model="featured" input-id="ds-toggle" />
            <label for="ds-toggle">Très demandé</label>
          </div>
        </div>
      </div>
    </section>

    <!-- Badges -->
    <section class="ds-section">
      <h2 class="ds-section__title">Badges de cycle de vie — six familles</h2>
      <div class="ds-card">
        <div class="ds-row">
          <Tag
            v-for="family in badgeFamilies"
            :key="family.label"
            :value="family.label"
            :severity="family.severity === 'gold' ? undefined : family.severity"
            :class="family.severity === 'gold' ? 'ds-tag--gold' : undefined"
          />
        </div>
        <p class="ds-note">
          46 statuts au total à travers les 4 cycles de vie (demande,
          mission, speaker, candidature) — la correspondance statut → famille
          vit dans le code métier de chaque phase, pas ici.
        </p>
      </div>
    </section>

    <!-- Tableau -->
    <section class="ds-section">
      <div class="ds-section__title-row">
        <h2 class="ds-section__title">Tableau de données</h2>
        <label class="ds-density">
          <ToggleSwitch v-model="compactTable" input-id="ds-density" />
          <span>Densité compacte</span>
        </label>
      </div>
      <div class="ds-card ds-card--flush">
        <DataTable
          :value="speakers"
          :size="compactTable ? 'small' : undefined"
          striped-rows
        >
          <Column field="name" header="Nom">
            <template #body="{ data }">
              <div class="ds-table-name">
                <Avatar
                  :label="data.name.split(' ').map((p: string) => p[0]).join('')"
                  shape="circle"
                  size="normal"
                />
                <span>{{ data.name }}</span>
              </div>
            </template>
          </Column>
          <Column field="title" header="Titre" />
          <Column field="country" header="Pays" />
          <Column field="tier" header="Tarif" />
          <Column field="status" header="Statut">
            <template #body="{ data }">
              <Tag
                :value="data.status"
                :severity="data.severity === 'gold' ? undefined : data.severity"
                :class="data.severity === 'gold' ? 'ds-tag--gold' : undefined"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- États vides / chargement / erreur -->
    <section class="ds-section">
      <h2 class="ds-section__title">États vides, chargement, erreur</h2>
      <div class="ds-grid">
        <div class="ds-card ds-empty">
          <span class="ds-empty__icon">＋</span>
          <div class="ds-empty__title">Aucune candidature pour l'instant</div>
          <p class="ds-empty__text">
            Les candidatures reçues via le site public apparaîtront ici dès
            la première soumission.
          </p>
          <Button label="Inviter un speaker" size="small" />
        </div>
        <div class="ds-card ds-empty">
          <span class="ds-empty__icon">⌕</span>
          <div class="ds-empty__title">Aucun speaker ne correspond</div>
          <p class="ds-empty__text">
            4 filtres actifs : Statut, Pays, Langue, Disponibilité.
          </p>
          <Button
            label="Réinitialiser les filtres"
            size="small"
            severity="secondary"
            outlined
          />
        </div>
        <div class="ds-card ds-skeleton">
          <div v-for="n in 4" :key="n" class="ds-skeleton__row">
            <Skeleton shape="circle" size="1.75rem" />
            <Skeleton height="0.75rem" />
            <Skeleton width="3rem" height="0.75rem" />
          </div>
        </div>
        <div class="ds-card ds-empty ds-empty--error">
          <span class="ds-empty__icon ds-empty__icon--error">!</span>
          <div class="ds-empty__title">Impossible de charger les demandes</div>
          <p class="ds-empty__text">
            Erreur 503 du service Demandes. Vos filtres et votre sélection
            sont conservés.
          </p>
          <div class="ds-row">
            <Button label="Réessayer" size="small" />
            <Button label="Détail technique" size="small" text />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ds {
  min-height: 100vh;
  background: var(--asb-surface-page);
  padding: var(--asb-space-8) var(--asb-space-6) var(--asb-space-18);
  max-width: 1100px;
  margin: 0 auto;
}

.ds__header {
  margin-bottom: var(--asb-space-8);
}

.ds__kicker {
  display: block;
  font-family: var(--asb-font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--asb-gold-700);
  margin-bottom: var(--asb-space-2);
}

.ds__title {
  margin: 0 0 var(--asb-space-2);
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-display);
  font-weight: 600;
  color: var(--asb-text);
}

.ds__lede {
  margin: 0;
  max-width: 64ch;
  color: var(--asb-text-muted);
  line-height: var(--asb-leading-body);
}

.ds-section {
  margin-bottom: var(--asb-space-8);
}

.ds-section__title {
  margin: 0 0 var(--asb-space-4);
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-xl);
  font-weight: 600;
  color: var(--asb-text);
}

.ds-section__title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--asb-space-3);
}

.ds-density {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.ds-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  box-shadow: var(--asb-shadow-1);
  padding: var(--asb-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

.ds-card--flush {
  padding: 0;
}

.ds-card--form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--asb-space-4) var(--asb-space-6);
  align-items: start;
}

.ds-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-3);
}

.ds-row--controls {
  gap: var(--asb-space-6);
}

.control {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-size: var(--asb-text-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-1);
}

.field--wide {
  grid-column: 1 / -1;
}

.field label {
  font-size: var(--asb-text-sm);
  font-weight: 600;
  color: var(--asb-text);
}

.field__hint {
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
}

.w-full {
  width: 100%;
}

/* Voir components/StatusTag.vue pour l'explication de :global() ici plutôt
   que :deep() (la classe atterrit sur la racine de <Tag>, pas un descendant). */
:global(.ds-tag--gold) {
  background: var(--asb-gold-50) !important;
  border: 1px solid var(--asb-gold-300) !important;
  color: var(--asb-gold-700) !important;
}

.ds-note {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  line-height: var(--asb-leading-body);
}

.ds-table-name {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
}

.ds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--asb-space-4);
}

.ds-empty {
  align-items: center;
  text-align: center;
  padding: var(--asb-space-8);
}

.ds-empty__icon {
  width: 44px;
  height: 44px;
  border: 1px solid var(--asb-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--asb-text-muted);
  font-size: 18px;
}

.ds-empty__icon--error {
  border-color: var(--asb-danger-600);
  background: var(--asb-danger-50);
  color: var(--asb-danger-600);
  font-weight: 700;
}

.ds-empty--error .ds-empty__icon {
  border-color: var(--asb-danger-600);
}

.ds-empty__title {
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}

.ds-empty__text {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  max-width: 34ch;
}

.ds-skeleton {
  gap: var(--asb-space-3);
}

.ds-skeleton__row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
}

.ds-skeleton__row :deep(.p-skeleton:nth-child(2)) {
  flex: 1;
}
</style>
