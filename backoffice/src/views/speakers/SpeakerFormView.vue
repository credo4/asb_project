<script setup lang="ts">
// 2.3 Formulaire de création/édition — l'écran le plus lourd. Sections
// ancrées avec le sommaire à complétion (composant sur mesure, voir
// components/CompletionSummary.vue).
import { computed, onMounted, reactive, ref, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import MultiSelect from 'primevue/multiselect';
import ToggleSwitch from 'primevue/toggleswitch';
import InputNumber from 'primevue/inputnumber';
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import { useToast } from 'primevue/usetoast';
import CompletionSummary, {
  type CompletionSection,
} from './components/CompletionSummary.vue';
import BackButton from '../../components/BackButton.vue';
import { useTaxonomiesStore } from '../../stores/taxonomies';
import {
  createSpeaker,
  fetchSpeaker,
  updateSpeaker,
  uploadPhoto,
  type CreateSpeakerBody,
  type SpeakerDetail,
} from '../../services/speakers';
import { FEE_TIER_LABELS } from '../../config/speaker-status';
import { mapMessagesToFields, type ApiError } from '../../lib/api-error';

const props = defineProps<{ id?: number }>();
const router = useRouter();
const toast = useToast();
const taxonomies = useTaxonomiesStore();
onMounted(() => {
  void taxonomies.ensureLoaded();
});

const isEditing = computed(() => props.id !== undefined);
const loading = ref(isEditing.value);
const loadError = ref<string | null>(null);
const saving = ref(false);
const fieldErrors = ref<Record<string, string[]>>({});
const currentSpeaker = ref<SpeakerDetail | null>(null);

function emptyForm(): CreateSpeakerBody {
  return {
    firstName: '',
    lastName: '',
    pillars: [],
    themeIds: [],
    formatIds: [],
    languages: [],
    keywords: [],
    engagements: [],
    media: [],
    pricing: {},
  };
}

const form = reactive<CreateSpeakerBody>(emptyForm());

// Modèles locaux distincts pour les champs qui ne se manipulent pas
// directement dans la forme attendue par l'API (id de pilier principal,
// tableau de mots-clés saisi comme texte, etc.).
const primaryPillarId = ref<number | null>(null);
const secondaryPillarIds = ref<number[]>([]);
const keywordsText = ref('');

function detailToForm(detail: SpeakerDetail): void {
  Object.assign(form, {
    civility: detail.civility ?? undefined,
    firstName: detail.firstName,
    lastName: detail.lastName,
    publicName: detail.publicName ?? undefined,
    email: detail.email ?? undefined,
    phone: detail.phone ?? undefined,
    countryId: detail.country?.id,
    nationalityCountryId: detail.nationality?.id,
    city: detail.city ?? undefined,
    timezone: detail.timezone ?? undefined,
    slug: detail.slug ?? undefined,
    profilePhotoUrl: detail.profilePhotoUrl ?? undefined,
    coverPhotoUrl: detail.coverPhotoUrl ?? undefined,
    professionalTitle: detail.professionalTitle ?? undefined,
    currentOrganization: detail.currentOrganization ?? undefined,
    currentPosition: detail.currentPosition ?? undefined,
    websiteUrl: detail.websiteUrl ?? undefined,
    linkedinUrl: detail.linkedinUrl ?? undefined,
    shortBio: detail.shortBio ?? undefined,
    fullBio: detail.fullBio ?? undefined,
    quote: detail.quote ?? undefined,
    expertiseSummary: detail.expertiseSummary ?? undefined,
    valueProposition: detail.valueProposition ?? undefined,
    careerPath: detail.careerPath ?? undefined,
    keyAchievements: detail.keyAchievements ?? undefined,
    awards: detail.awards ?? undefined,
    feeTierPublic: detail.feeTierPublic ?? undefined,
    isFeaturedHome: detail.isFeaturedHome,
    isTopRequested: detail.isTopRequested,
    showBudget: detail.showBudget,
    showLocation: detail.showLocation,
    allowIndexing: detail.allowIndexing,
    pillars: detail.pillars.map((p) => ({
      pillarId: p.pillar.id,
      isPrimary: p.isPrimary,
      displayOrder: p.displayOrder,
    })),
    themeIds: detail.themes.map((t) => t.id),
    formatIds: detail.formats.map((f) => f.id),
    keywords: detail.keywords,
    languages: detail.languages.map((l) => ({
      languageId: l.language.id,
      proficiency: l.proficiency,
      canPresent: l.canPresent,
      canQa: l.canQa,
      canModerate: l.canModerate,
    })),
    pricing: detail.pricing
      ? {
          currency: detail.pricing.currency,
          minFee: detail.pricing.minFee ? Number(detail.pricing.minFee) : undefined,
          recommendedFee: detail.pricing.recommendedFee
            ? Number(detail.pricing.recommendedFee)
            : undefined,
          feeKeynote: detail.pricing.feeKeynote ? Number(detail.pricing.feeKeynote) : undefined,
          feePanel: detail.pricing.feePanel ? Number(detail.pricing.feePanel) : undefined,
          feeWebinar: detail.pricing.feeWebinar ? Number(detail.pricing.feeWebinar) : undefined,
          feeMasterclass: detail.pricing.feeMasterclass
            ? Number(detail.pricing.feeMasterclass)
            : undefined,
          feeAdvisory: detail.pricing.feeAdvisory ? Number(detail.pricing.feeAdvisory) : undefined,
          feeOneToOne: detail.pricing.feeOneToOne
            ? Number(detail.pricing.feeOneToOne)
            : undefined,
          travelFees: detail.pricing.travelFees ?? undefined,
          negotiationTerms: detail.pricing.negotiationTerms ?? undefined,
          agencyCommission: detail.pricing.agencyCommission
            ? Number(detail.pricing.agencyCommission)
            : undefined,
          internalNotes: detail.pricing.internalNotes ?? undefined,
        }
      : {},
    engagements: detail.engagements.map((e) => ({
      eventName: e.eventName,
      organization: e.organization ?? undefined,
      countryId: e.country?.id,
      eventDate: e.eventDate ?? undefined,
      dateLabel: e.dateLabel ?? undefined,
      role: e.role ?? undefined,
      topic: e.topic ?? undefined,
      description: e.description ?? undefined,
      photoUrl: e.photoUrl ?? undefined,
      videoUrl: e.videoUrl ?? undefined,
      externalUrl: e.externalUrl ?? undefined,
      displayOrder: e.displayOrder,
    })),
    media: detail.media.map((m) => ({
      type: m.type,
      title: m.title ?? undefined,
      caption: m.caption ?? undefined,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl ?? undefined,
      displayOrder: m.displayOrder,
    })),
  });
  const primary = detail.pillars.find((p) => p.isPrimary);
  primaryPillarId.value = primary?.pillar.id ?? null;
  secondaryPillarIds.value = detail.pillars
    .filter((p) => !p.isPrimary)
    .map((p) => p.pillar.id);
  keywordsText.value = detail.keywords.join(', ');
}

async function load(): Promise<void> {
  if (!props.id) return;
  loading.value = true;
  loadError.value = null;
  try {
    const detail = await fetchSpeaker(props.id);
    currentSpeaker.value = detail;
    detailToForm(detail);
  } catch {
    loadError.value = 'Impossible de charger ce speaker.';
  } finally {
    loading.value = false;
  }
}
watchEffect(() => {
  void load();
});

// Synchronise pilier principal + piliers secondaires -> form.pillars, et le
// texte libre de mots-clés -> form.keywords (tableau).
watchEffect(() => {
  const pillars: NonNullable<CreateSpeakerBody['pillars']> = [];
  if (primaryPillarId.value) {
    pillars.push({ pillarId: primaryPillarId.value, isPrimary: true });
  }
  for (const id of secondaryPillarIds.value) {
    if (id !== primaryPillarId.value) pillars.push({ pillarId: id, isPrimary: false });
  }
  form.pillars = pillars;
});
watchEffect(() => {
  form.keywords = keywordsText.value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
});

const pillarOptions = computed(() =>
  taxonomies.pillars.map((p) => ({ value: p.id, label: p.name })),
);
const themeOptions = computed(() => taxonomies.themes.map((t) => ({ value: t.id, label: t.name })));
const formatOptions = computed(() => taxonomies.formats.map((f) => ({ value: f.id, label: f.name })));
const languageOptions = computed(() =>
  taxonomies.languages.map((l) => ({ value: l.id, label: l.name })),
);
const countryOptions = computed(() =>
  taxonomies.countries.map((c) => ({ value: c.id, label: c.name })),
);
const feeTierOptions = Object.entries(FEE_TIER_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const proficiencyOptions = [
  { value: 'NATIVE', label: 'Langue maternelle' },
  { value: 'FLUENT', label: 'Courant' },
  { value: 'PROFESSIONAL', label: 'Professionnel' },
  { value: 'INTERMEDIATE', label: 'Intermédiaire' },
];
const mediaTypeOptions = [
  { value: 'PHOTO', label: 'Photo' },
  { value: 'VIDEO', label: 'Vidéo' },
  { value: 'PRESS_KIT', label: 'Dossier de presse' },
];

// --- Photo de profil / couverture ---
const uploadingProfilePhoto = ref(false);
const uploadingCoverPhoto = ref(false);
async function onSelectProfilePhoto(event: FileUploadSelectEvent): Promise<void> {
  const file = (event.files as File[])[0];
  if (!file) return;
  uploadingProfilePhoto.value = true;
  try {
    const result = await uploadPhoto(file);
    form.profilePhotoUrl = result.url;
  } finally {
    uploadingProfilePhoto.value = false;
  }
}
async function onSelectCoverPhoto(event: FileUploadSelectEvent): Promise<void> {
  const file = (event.files as File[])[0];
  if (!file) return;
  uploadingCoverPhoto.value = true;
  try {
    const result = await uploadPhoto(file);
    form.coverPhotoUrl = result.url;
  } finally {
    uploadingCoverPhoto.value = false;
  }
}

// --- Engagements (sous-formulaire répétable) ---
function addEngagement(): void {
  form.engagements = [...(form.engagements ?? []), { eventName: '' }];
}
function removeEngagement(index: number): void {
  form.engagements = (form.engagements ?? []).filter((_, i) => i !== index);
}

// --- Médias additionnels ---
function addMedia(): void {
  form.media = [...(form.media ?? []), { type: 'PHOTO', url: '' }];
}
function removeMedia(index: number): void {
  form.media = (form.media ?? []).filter((_, i) => i !== index);
}
const uploadingMediaIndex = ref<number | null>(null);
async function onSelectMediaPhoto(index: number, event: FileUploadSelectEvent): Promise<void> {
  const file = (event.files as File[])[0];
  if (!file || !form.media) return;
  uploadingMediaIndex.value = index;
  try {
    const result = await uploadPhoto(file);
    form.media[index] = { ...form.media[index], url: result.url, thumbnailUrl: result.thumbnailUrl };
  } finally {
    uploadingMediaIndex.value = null;
  }
}

// --- Sommaire à complétion (indicateur LOCAL, voir CompletionSummary.vue) ---
const sections = computed<CompletionSection[]>(() => [
  {
    id: 'section-general',
    label: 'Informations générales',
    filled: Boolean(form.firstName && form.lastName && form.countryId),
  },
  {
    id: 'section-presentation',
    label: 'Présentation publique',
    filled: Boolean(form.shortBio),
  },
  {
    id: 'section-expertise',
    label: 'Expertise',
    filled: (form.pillars?.length ?? 0) > 0,
  },
  {
    id: 'section-formats',
    label: 'Formats',
    filled: (form.formatIds?.length ?? 0) > 0,
  },
  {
    id: 'section-languages',
    label: 'Langues',
    filled: (form.languages?.length ?? 0) > 0,
  },
  {
    id: 'section-pricing',
    label: 'Tarification',
    filled: Boolean(form.pricing?.recommendedFee),
  },
  {
    id: 'section-engagements',
    label: 'Engagements',
    filled: (form.engagements?.length ?? 0) > 0,
  },
  {
    id: 'section-media',
    label: 'Médias',
    filled: Boolean(form.profilePhotoUrl),
  },
  {
    id: 'section-visibility',
    label: 'Visibilité',
    filled: true,
  },
]);

const KNOWN_FIELDS = [
  'firstName',
  'lastName',
  'publicName',
  'email',
  'phone',
  'countryId',
  'slug',
  'shortBio',
  'fullBio',
  'pillars',
  'themeIds',
  'formatIds',
  'languages',
  'pricing',
  'engagements',
  'media',
] as const;

async function onSubmit(): Promise<void> {
  fieldErrors.value = {};
  saving.value = true;
  try {
    const body = { ...form };
    const result =
      isEditing.value && props.id
        ? await updateSpeaker(props.id, body)
        : await createSpeaker(body);
    await router.push({ name: 'speakers-detail', params: { id: result.id } });
    toast.add({
      severity: 'success',
      summary: isEditing.value ? 'Speaker mis à jour' : 'Speaker créé',
      life: 3000,
    });
  } catch (err) {
    const apiError = err as ApiError;
    if (apiError?.isValidationError) {
      const { fieldErrors: mapped } = mapMessagesToFields(
        apiError.messages,
        KNOWN_FIELDS,
      );
      fieldErrors.value = mapped;
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="speaker-form">
    <div v-if="loading" class="speaker-form__skeleton">
      <Skeleton height="2rem" width="18rem" />
      <Skeleton height="20rem" />
    </div>

    <Message v-else-if="loadError" severity="error">{{ loadError }}</Message>

    <template v-else>
      <div class="speaker-form__header">
        <BackButton :to="{ name: 'speakers-list' }" label="Speakers" />
        <h1 class="speaker-form__title">
          {{ isEditing ? 'Modifier le speaker' : 'Nouveau speaker' }}
        </h1>
      </div>

      <form class="speaker-form__layout" @submit.prevent="onSubmit">
        <CompletionSummary
          class="speaker-form__summary"
          :sections="sections"
          :overall-score="currentSpeaker?.completionScore"
        />

        <div class="speaker-form__sections">
          <section id="section-general" class="form-card">
            <h2 class="form-card__title">Informations générales</h2>
            <div class="form-grid">
              <div class="field">
                <label for="f-civility">Civilité</label>
                <InputText id="f-civility" v-model="form.civility" />
              </div>
              <div class="field">
                <label for="f-firstName">Prénom *</label>
                <InputText
                  id="f-firstName"
                  v-model="form.firstName"
                  :invalid="Boolean(fieldErrors.firstName)"
                  required
                />
                <Message
                  v-for="m in fieldErrors.firstName"
                  :key="m"
                  severity="error"
                  variant="simple"
                  size="small"
                  >{{ m }}</Message
                >
              </div>
              <div class="field">
                <label for="f-lastName">Nom *</label>
                <InputText
                  id="f-lastName"
                  v-model="form.lastName"
                  :invalid="Boolean(fieldErrors.lastName)"
                  required
                />
                <Message
                  v-for="m in fieldErrors.lastName"
                  :key="m"
                  severity="error"
                  variant="simple"
                  size="small"
                  >{{ m }}</Message
                >
              </div>
              <div class="field">
                <label for="f-publicName">Nom public</label>
                <InputText id="f-publicName" v-model="form.publicName" />
                <span class="field__hint">Tel qu'il apparaîtra sur la fiche publique.</span>
              </div>
              <div class="field">
                <label for="f-email">E-mail</label>
                <InputText
                  id="f-email"
                  v-model="form.email"
                  type="email"
                  :invalid="Boolean(fieldErrors.email)"
                />
                <Message
                  v-for="m in fieldErrors.email"
                  :key="m"
                  severity="error"
                  variant="simple"
                  size="small"
                  >{{ m }}</Message
                >
              </div>
              <div class="field">
                <label for="f-phone">Téléphone</label>
                <InputText id="f-phone" v-model="form.phone" />
              </div>
              <div class="field">
                <label for="f-country">Pays de résidence</label>
                <Select
                  id="f-country"
                  v-model="form.countryId"
                  :options="countryOptions"
                  option-label="label"
                  option-value="value"
                  filter
                  show-clear
                />
              </div>
              <div class="field">
                <label for="f-nationality">Nationalité</label>
                <Select
                  id="f-nationality"
                  v-model="form.nationalityCountryId"
                  :options="countryOptions"
                  option-label="label"
                  option-value="value"
                  filter
                  show-clear
                />
              </div>
              <div class="field">
                <label for="f-city">Ville</label>
                <InputText id="f-city" v-model="form.city" />
              </div>
              <div class="field">
                <label for="f-timezone">Fuseau horaire</label>
                <InputText id="f-timezone" v-model="form.timezone" placeholder="Africa/Nairobi" />
              </div>
              <div class="field">
                <label for="f-slug">Slug</label>
                <InputText
                  id="f-slug"
                  v-model="form.slug"
                  :invalid="Boolean(fieldErrors.slug)"
                />
                <span class="field__hint">Laisser vide pour générer automatiquement.</span>
                <Message
                  v-for="m in fieldErrors.slug"
                  :key="m"
                  severity="error"
                  variant="simple"
                  size="small"
                  >{{ m }}</Message
                >
              </div>
              <div class="field">
                <label for="f-title">Titre professionnel</label>
                <InputText id="f-title" v-model="form.professionalTitle" />
              </div>
              <div class="field">
                <label for="f-org">Organisation actuelle</label>
                <InputText id="f-org" v-model="form.currentOrganization" />
              </div>
              <div class="field">
                <label for="f-position">Poste actuel</label>
                <InputText id="f-position" v-model="form.currentPosition" />
              </div>
              <div class="field">
                <label for="f-website">Site web</label>
                <InputText id="f-website" v-model="form.websiteUrl" />
              </div>
              <div class="field">
                <label for="f-linkedin">LinkedIn</label>
                <InputText id="f-linkedin" v-model="form.linkedinUrl" />
              </div>
            </div>
          </section>

          <section id="section-presentation" class="form-card">
            <h2 class="form-card__title">Présentation publique</h2>
            <div class="form-grid form-grid--wide">
              <div class="field">
                <label for="f-shortBio">Bio courte</label>
                <Textarea id="f-shortBio" v-model="form.shortBio" rows="3" auto-resize />
              </div>
              <div class="field">
                <label for="f-fullBio">Bio complète</label>
                <Textarea id="f-fullBio" v-model="form.fullBio" rows="6" auto-resize />
              </div>
              <div class="field">
                <label for="f-quote">Citation</label>
                <Textarea id="f-quote" v-model="form.quote" rows="2" auto-resize />
              </div>
              <div class="field">
                <label for="f-expertiseSummary">Résumé d'expertise</label>
                <Textarea id="f-expertiseSummary" v-model="form.expertiseSummary" rows="3" auto-resize />
              </div>
              <div class="field">
                <label for="f-valueProposition">Proposition de valeur</label>
                <Textarea id="f-valueProposition" v-model="form.valueProposition" rows="3" auto-resize />
              </div>
              <div class="field">
                <label for="f-careerPath">Parcours</label>
                <Textarea id="f-careerPath" v-model="form.careerPath" rows="3" auto-resize />
              </div>
              <div class="field">
                <label for="f-keyAchievements">Réalisations clés</label>
                <Textarea id="f-keyAchievements" v-model="form.keyAchievements" rows="3" auto-resize />
              </div>
              <div class="field">
                <label for="f-awards">Distinctions</label>
                <Textarea id="f-awards" v-model="form.awards" rows="2" auto-resize />
              </div>
            </div>
          </section>

          <section id="section-expertise" class="form-card">
            <h2 class="form-card__title">Expertise</h2>
            <div class="form-grid">
              <div class="field">
                <label for="f-primaryPillar">Pilier principal</label>
                <Select
                  id="f-primaryPillar"
                  v-model="primaryPillarId"
                  :options="pillarOptions"
                  option-label="label"
                  option-value="value"
                  show-clear
                />
              </div>
              <div class="field">
                <label for="f-secondaryPillars">Autres piliers</label>
                <MultiSelect
                  id="f-secondaryPillars"
                  v-model="secondaryPillarIds"
                  :options="pillarOptions"
                  option-label="label"
                  option-value="value"
                  display="chip"
                />
              </div>
              <div class="field">
                <label for="f-themes">Thèmes</label>
                <MultiSelect
                  id="f-themes"
                  v-model="form.themeIds"
                  :options="themeOptions"
                  option-label="label"
                  option-value="value"
                  display="chip"
                  filter
                />
              </div>
              <div class="field field--wide">
                <label for="f-keywords">Mots-clés</label>
                <InputText
                  id="f-keywords"
                  v-model="keywordsText"
                  placeholder="gouvernance, climat, innovation"
                />
                <span class="field__hint">Séparés par des virgules.</span>
              </div>
            </div>
          </section>

          <section id="section-formats" class="form-card">
            <h2 class="form-card__title">Formats</h2>
            <MultiSelect
              v-model="form.formatIds"
              :options="formatOptions"
              option-label="label"
              option-value="value"
              display="chip"
              class="w-full"
            />
          </section>

          <section id="section-languages" class="form-card">
            <h2 class="form-card__title">Langues</h2>
            <div
              v-for="(lang, index) in form.languages"
              :key="index"
              class="repeatable-row"
            >
              <Select
                v-model="lang.languageId"
                :options="languageOptions"
                option-label="label"
                option-value="value"
                placeholder="Langue"
              />
              <Select
                v-model="lang.proficiency"
                :options="proficiencyOptions"
                option-label="label"
                option-value="value"
                placeholder="Niveau"
              />
              <Button
                icon="pi pi-trash"
                text
                severity="danger"
                aria-label="Retirer"
                @click="form.languages = (form.languages ?? []).filter((_, i) => i !== index)"
              />
            </div>
            <Button
              label="Ajouter une langue"
              icon="pi pi-plus"
              text
              size="small"
              @click="form.languages = [...(form.languages ?? []), { languageId: 0 }]"
            />
          </section>

          <!-- Zone confidentielle -->
          <section id="section-pricing" class="form-card form-card--confidential">
            <h2 class="form-card__title">
              Tarification <span class="confidential-badge">Confidentiel</span>
            </h2>
            <div class="form-grid">
              <div class="field">
                <label for="f-feeTierPublic">Niveau tarifaire public</label>
                <Select
                  id="f-feeTierPublic"
                  v-model="form.feeTierPublic"
                  :options="feeTierOptions"
                  option-label="label"
                  option-value="value"
                  show-clear
                />
              </div>
              <div class="field">
                <label for="f-currency">Devise</label>
                <InputText id="f-currency" v-model="form.pricing!.currency" placeholder="USD" />
              </div>
              <div class="field">
                <label for="f-minFee">Tarif minimum</label>
                <InputNumber id="f-minFee" v-model="form.pricing!.minFee" mode="decimal" />
              </div>
              <div class="field">
                <label for="f-recommendedFee">Tarif recommandé</label>
                <InputNumber id="f-recommendedFee" v-model="form.pricing!.recommendedFee" mode="decimal" />
              </div>
              <div class="field">
                <label for="f-feeKeynote">Keynote</label>
                <InputNumber id="f-feeKeynote" v-model="form.pricing!.feeKeynote" mode="decimal" />
              </div>
              <div class="field">
                <label for="f-feePanel">Panel</label>
                <InputNumber id="f-feePanel" v-model="form.pricing!.feePanel" mode="decimal" />
              </div>
              <div class="field">
                <label for="f-feeWebinar">Webinar</label>
                <InputNumber id="f-feeWebinar" v-model="form.pricing!.feeWebinar" mode="decimal" />
              </div>
              <div class="field">
                <label for="f-feeMasterclass">Masterclass</label>
                <InputNumber id="f-feeMasterclass" v-model="form.pricing!.feeMasterclass" mode="decimal" />
              </div>
              <div class="field">
                <label for="f-agencyCommission">Commission agence</label>
                <InputNumber id="f-agencyCommission" v-model="form.pricing!.agencyCommission" mode="decimal" />
              </div>
              <div class="field field--wide">
                <label for="f-internalNotes">Notes internes</label>
                <Textarea id="f-internalNotes" v-model="form.pricing!.internalNotes" rows="2" auto-resize />
              </div>
            </div>
          </section>

          <section id="section-engagements" class="form-card">
            <h2 class="form-card__title">Engagements signature</h2>
            <div
              v-for="(engagement, index) in form.engagements"
              :key="index"
              class="engagement-card"
            >
              <div class="form-grid">
                <div class="field">
                  <label>Événement *</label>
                  <InputText v-model="engagement.eventName" />
                </div>
                <div class="field">
                  <label>Organisation</label>
                  <InputText v-model="engagement.organization" />
                </div>
                <div class="field">
                  <label>Date (libellé)</label>
                  <InputText v-model="engagement.dateLabel" placeholder="Mars 2025" />
                </div>
                <div class="field">
                  <label>Rôle</label>
                  <InputText v-model="engagement.role" />
                </div>
                <div class="field field--wide">
                  <label>Sujet</label>
                  <InputText v-model="engagement.topic" />
                </div>
              </div>
              <Button
                label="Retirer cet engagement"
                icon="pi pi-trash"
                text
                severity="danger"
                size="small"
                @click="removeEngagement(index)"
              />
            </div>
            <Button
              label="Ajouter un engagement"
              icon="pi pi-plus"
              text
              size="small"
              @click="addEngagement"
            />
          </section>

          <section id="section-media" class="form-card">
            <h2 class="form-card__title">Médias</h2>

            <div class="form-grid">
              <div class="field">
                <label>Photo de profil</label>
                <FileUpload
                  mode="basic"
                  accept="image/jpeg,image/png,image/webp"
                  :auto="false"
                  choose-label="Choisir…"
                  custom-upload
                  @select="onSelectProfilePhoto"
                />
                <span v-if="uploadingProfilePhoto" class="field__hint">Envoi en cours…</span>
                <img
                  v-if="form.profilePhotoUrl"
                  :src="form.profilePhotoUrl"
                  alt="Photo de profil"
                  class="photo-preview"
                />
              </div>
              <div class="field">
                <label>Photo de couverture</label>
                <FileUpload
                  mode="basic"
                  accept="image/jpeg,image/png,image/webp"
                  :auto="false"
                  choose-label="Choisir…"
                  custom-upload
                  @select="onSelectCoverPhoto"
                />
                <span v-if="uploadingCoverPhoto" class="field__hint">Envoi en cours…</span>
                <img
                  v-if="form.coverPhotoUrl"
                  :src="form.coverPhotoUrl"
                  alt="Photo de couverture"
                  class="photo-preview photo-preview--wide"
                />
              </div>
            </div>

            <h3 class="form-card__subtitle">Galerie</h3>
            <div v-for="(item, index) in form.media" :key="index" class="media-row">
              <Select
                v-model="item.type"
                :options="mediaTypeOptions"
                option-label="label"
                option-value="value"
              />
              <template v-if="item.type === 'PHOTO'">
                <FileUpload
                  mode="basic"
                  accept="image/jpeg,image/png,image/webp"
                  :auto="false"
                  choose-label="Choisir…"
                  custom-upload
                  @select="(e) => onSelectMediaPhoto(index, e)"
                />
                <span v-if="uploadingMediaIndex === index" class="field__hint"
                  >Envoi en cours…</span
                >
              </template>
              <InputText v-else v-model="item.url" placeholder="URL" />
              <InputText v-model="item.title" placeholder="Titre (optionnel)" />
              <Button
                icon="pi pi-trash"
                text
                severity="danger"
                aria-label="Retirer"
                @click="removeMedia(index)"
              />
            </div>
            <Button
              label="Ajouter un média"
              icon="pi pi-plus"
              text
              size="small"
              @click="addMedia"
            />
          </section>

          <section id="section-visibility" class="form-card">
            <h2 class="form-card__title">Visibilité</h2>
            <div class="toggle-list">
              <div class="toggle-row">
                <ToggleSwitch v-model="form.isFeaturedHome" input-id="f-featured" />
                <label for="f-featured">Mis en avant sur la page d'accueil</label>
              </div>
              <div class="toggle-row">
                <ToggleSwitch v-model="form.isTopRequested" input-id="f-top" />
                <label for="f-top">Très demandé</label>
              </div>
              <div class="toggle-row">
                <ToggleSwitch v-model="form.showBudget" input-id="f-showBudget" />
                <label for="f-showBudget">Afficher le niveau tarifaire publiquement</label>
              </div>
              <div class="toggle-row">
                <ToggleSwitch v-model="form.showLocation" input-id="f-showLocation" />
                <label for="f-showLocation">Afficher la localisation</label>
              </div>
              <div class="toggle-row">
                <ToggleSwitch v-model="form.allowIndexing" input-id="f-allowIndexing" />
                <label for="f-allowIndexing">Autoriser l'indexation (moteurs de recherche)</label>
              </div>
            </div>
          </section>

          <div class="speaker-form__actions">
            <Button
              type="submit"
              :label="isEditing ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'"
              :loading="saving"
            />
            <Button
              label="Annuler"
              text
              type="button"
              @click="router.back()"
            />
          </div>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.speaker-form__header {
  margin-bottom: var(--asb-space-4);
}


.speaker-form__title {
  margin: var(--asb-space-2) 0 0;
  font-family: var(--asb-font-display);
  font-size: var(--asb-text-2xl);
  font-weight: 600;
  color: var(--asb-text);
}

.speaker-form__layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--asb-space-6);
  align-items: start;
}

.speaker-form__sections {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
  min-width: 0;
}

.form-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
  scroll-margin-top: var(--asb-space-4);
}

.form-card--confidential {
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

.form-card__title {
  margin: 0 0 var(--asb-space-4);
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.form-card__subtitle {
  margin: var(--asb-space-4) 0 var(--asb-space-2);
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--asb-space-4);
}

.form-grid--wide {
  grid-template-columns: 1fr;
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

.repeatable-row,
.media-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  margin-bottom: var(--asb-space-2);
  flex-wrap: wrap;
}

.engagement-card {
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-4);
  margin-bottom: var(--asb-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
}

.photo-preview {
  margin-top: var(--asb-space-2);
  max-width: 120px;
  border: 1px solid var(--asb-border);
}

.photo-preview--wide {
  max-width: 240px;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  font-size: var(--asb-text-sm);
}

.speaker-form__actions {
  display: flex;
  gap: var(--asb-space-3);
  padding: var(--asb-space-4) 0;
}

.speaker-form__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-4);
}

@media (max-width: 900px) {
  .speaker-form__layout {
    grid-template-columns: 1fr;
  }
  .speaker-form__summary {
    position: static;
  }
}
</style>
