// Jeu de données de démonstration (demande explicite : démo de samedi).
//
// Usage (depuis backend/) :
//   npm run seed:demo-scenario              # DRY-RUN (rien n'est écrit)
//   npm run seed:demo-scenario -- --execute # exécute RÉELLEMENT les écritures
//
// IMPORTANT — exécutable contre la production : `DATABASE_URL` détermine la
// cible, comme pour n'importe quel autre script de ce dossier. Toujours
// relancer d'abord SANS --execute pour relire le plan affiché (comme
// cleanup:test-data), quelle que soit la base visée.
//
// -----------------------------------------------------------------------
// IDEMPOTENCE — pas de marqueur "[TEST]" (demande explicite : ces données
// doivent avoir l'air vraies), donc pas de recherche par préfixe possible.
// Chaque type d'entité a sa propre clé naturelle, vérifiée par une lecture
// AVANT toute écriture (jamais un "je sais déjà ce que j'ai créé la
// dernière fois" mémorisé côté script) :
//   - speakers               : slug FIXE (même principe que seed-demo-speakers.ts)
//   - organizations          : nom exact (pas de contrainte unique en base
//                              sur ce champ — voir schema.prisma — donc
//                              cette vérification EST la seule garde ;
//                              noms volontairement distinctifs pour rendre
//                              une collision avec une vraie fiche cliente
//                              improbable, mais le dry-run reste la
//                              vérification humaine avant --execute)
//   - contacts               : email normalisé (contrainte unique en base)
//   - booking requests       : couple (workEmail, eventName)
//   - roster applications    : workEmail
//   - speaker revisions      : speakerId + status SUBMITTED (une seule
//                              révision active par speaker, comme l'app)
//   - booking_request_speakers : couple (requestId, speakerId), déjà unique
//   - availability requests  : couple (bookingRequestId, speakerId), tous
//                              statuts confondus (une seule sollicitation
//                              DÉMO par couple, pas juste "une active")
//   - missions               : couple (bookingRequestId, speakerId), déjà
//                              unique via activeGuard sur les lignes actives
//   - checklist/document/activity log de la mission : seulement instanciés
//     la première fois que LA mission elle-même est créée dans cette
//     exécution (pas de vérification séparée : ils sont 1:1 avec elle)
//
// -----------------------------------------------------------------------
// AUCUN appel aux services NestJS (pas de bootstrap d'app, pas d'email) :
// écritures Prisma directes + réutilisation des utilitaires PURS déjà
// utilisés par l'app (générateur de référence, gabarit de checklist,
// slugify) pour rester fidèle à la vraie logique métier sans dupliquer de
// règles à la main. Volontairement AUCUN envoi d'email (contrairement à un
// vrai POST /admin/booking-requests, etc.) : ce script ne doit jamais
// tenter de contacter un vrai serveur SMTP en production pour des adresses
// fictives. Toutes les adresses "client" utilisent le TLD `.test` (réservé
// IANA/RFC 2606, garanti non routable) — jamais un vrai domaine.
import { randomUUID } from 'crypto';
import { promises as fsp } from 'fs';
import { resolve } from 'path';
import {
  PrismaClient,
  Prisma,
  SpeakerStatus,
  BookingStatus,
  BookingPriority,
  BookingRequestSource,
  BookingRequestSpeakerStatus,
  ApplicationStatus,
  AvailabilityRequestStatus,
  AvailabilityResponseStatus,
  MissionStatus,
  MissionContractStatus,
  MissionPaymentStatus,
  MissionLogisticsStatus,
  MissionDocumentType,
  Role,
  UserStatus,
} from '@prisma/client';
import { slugify } from '../src/modules/speakers/slug.util';
import { createWithUniqueReference } from '../src/common/utils/reference-generator.util';
import { MISSION_CHECKLIST_TEMPLATE } from '../src/modules/missions/mission-checklist.constants';
import { MISSION_DOCUMENT_SUBDIR } from '../src/modules/missions/mission-documents.constants';

const prisma = new PrismaClient();

const execute = process.argv.includes('--execute');
const dryRun = !execute;

function log(line: string): void {
  console.log(`[seed:demo-scenario] ${line}`);
}

// -----------------------------------------------------------------------
// Dates relatives — pour que le jeu de données ait l'air d'avoir vécu
// (créé "il y a 3 semaines", pas tout d'un coup "maintenant").
// -----------------------------------------------------------------------
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// =========================================================================
// 1. SPEAKERS — 11 au total : 7 publiés, 2 brouillons, 1 en attente de
//    validation, 1 profil incomplet.
// =========================================================================

interface DemoSpeakerDef {
  slug: string;
  firstName: string;
  lastName: string;
  status: SpeakerStatus;
  countryName: string | null;
  city: string | null;
  professionalTitle: string | null;
  currentOrganization: string | null;
  shortBio: string | null;
  fullBio: string | null;
  pillarSlug: string | null;
  formatSlugs: string[];
  languageCodes: string[];
  isFeaturedHome: boolean;
  isTopRequested: boolean;
  showBudget: boolean;
  feeTierPublic: 'TIER_1' | 'TIER_2' | 'TIER_3' | null;
  withPhoto: boolean;
  withEngagement: {
    eventName: string;
    organization: string;
    dateLabel: string;
    role: string;
    topic: string;
    description: string;
  } | null;
}

const DEMO_SPEAKERS: DemoSpeakerDef[] = [
  {
    slug: 'yasmin-toure',
    firstName: 'Yasmin',
    lastName: 'Touré',
    status: 'PUBLISHED',
    countryName: "Cote d'Ivoire",
    city: 'Abidjan',
    professionalTitle: 'Senior Policy Advisor & Governance Consultant',
    currentOrganization: 'Continental Governance Institute',
    shortBio:
      "Yasmin Touré conseille gouvernements et institutions régionales sur la réforme institutionnelle et la gouvernance publique en Afrique de l'Ouest.",
    fullBio:
      "Après quinze ans passés entre le secteur public et les organisations multilatérales, Yasmin Touré accompagne aujourd'hui gouvernements, banques de développement et institutions régionales sur les réformes de gouvernance publique et de transparence budgétaire. Elle intervient régulièrement dans les grandes conférences panafricaines sur le rôle des institutions dans la trajectoire de développement du continent.",
    pillarSlug: 'governance-african-voice',
    formatSlugs: ['keynote', 'panellist', 'advisor'],
    languageCodes: ['fr', 'en'],
    isFeaturedHome: true,
    isTopRequested: false,
    showBudget: true,
    feeTierPublic: 'TIER_2',
    withPhoto: true,
    withEngagement: {
      eventName: "Forum sur la Gouvernance en Afrique de l'Ouest",
      organization: 'Union Économique et Monétaire Ouest Africaine',
      dateLabel: '2025',
      role: 'Conférencière principale',
      topic: 'Réforme institutionnelle et transparence budgétaire',
      description:
        "Intervention d'ouverture sur les leviers concrets de réforme de la gouvernance publique dans la sous-région.",
    },
  },
  {
    slug: 'emeka-adeyemi',
    firstName: 'Emeka',
    lastName: 'Adeyemi',
    status: 'PUBLISHED',
    countryName: 'Nigeria',
    city: 'Lagos',
    professionalTitle: 'Energy Entrepreneur & Infrastructure Investor',
    currentOrganization: 'Delta Power Holdings',
    shortBio:
      "Emeka Adeyemi a fondé l'un des principaux développeurs indépendants d'énergie renouvelable du Nigeria et parle d'investissement en infrastructure et de transition énergétique.",
    fullBio:
      "Emeka Adeyemi a construit Delta Power Holdings à partir de rien pour en faire l'un des développeurs indépendants d'énergie solaire et hybride les plus actifs d'Afrique de l'Ouest. Il partage son expérience de la levée de capitaux en Afrique, de la structuration de projets d'infrastructure bancables et de la transition énergétique vue depuis le terrain plutôt que depuis les rapports.",
    pillarSlug: 'enterprise-prosperity',
    formatSlugs: ['keynote', 'panellist', 'executive-training'],
    languageCodes: ['en'],
    isFeaturedHome: false,
    isTopRequested: true,
    showBudget: true,
    feeTierPublic: 'TIER_2',
    withPhoto: true,
    withEngagement: {
      eventName: 'Africa Energy Investment Summit',
      organization: 'West African Power Pool',
      dateLabel: '2025',
      role: 'Panéliste',
      topic: 'Financer la transition énergétique en Afrique',
      description:
        "Panel sur la structuration de projets d'énergie renouvelable bancables à l'échelle régionale.",
    },
  },
  {
    slug: 'lindiwe-dube',
    firstName: 'Lindiwe',
    lastName: 'Dube',
    status: 'PUBLISHED',
    countryName: 'South Africa',
    city: 'Cape Town',
    professionalTitle: 'Documentary Filmmaker & Media Entrepreneur',
    currentOrganization: 'Baobab Films',
    shortBio:
      'Lindiwe Dube réalise des documentaires primés sur les identités africaines contemporaines et intervient sur le pouvoir du récit et la production médiatique indépendante.',
    fullBio:
      'Réalisatrice et productrice, Lindiwe Dube a fondé Baobab Films après une carrière dans les médias traditionnels sud-africains. Ses documentaires, primés dans plusieurs festivals internationaux, explorent les identités africaines contemporaines. Elle intervient sur la production médiatique indépendante, le financement créatif et le récit comme outil de transformation sociale.',
    pillarSlug: 'culture-narrative-media',
    formatSlugs: ['keynote', 'moderator', 'fireside-chat'],
    languageCodes: ['en'],
    isFeaturedHome: false,
    isTopRequested: false,
    showBudget: false,
    feeTierPublic: 'TIER_1',
    withPhoto: true,
    withEngagement: {
      eventName: 'Pan-African Storytelling Festival',
      organization: 'African Screen Guild',
      dateLabel: '2024',
      role: 'Intervenante en fireside chat',
      topic: 'Le récit comme outil de transformation sociale',
      description:
        'Conversation sur le financement du cinéma indépendant africain et son impact culturel.',
    },
  },
  {
    slug: 'samuel-otieno',
    firstName: 'Samuel',
    lastName: 'Otieno',
    status: 'PUBLISHED',
    countryName: 'Kenya',
    city: 'Nairobi',
    professionalTitle: 'AI Researcher & Digital Infrastructure Strategist',
    currentOrganization: 'Nairobi Institute for Applied AI',
    shortBio:
      'Samuel Otieno dirige des recherches appliquées en intelligence artificielle et conseille gouvernements et entreprises sur la souveraineté numérique du continent.',
    fullBio:
      "Chercheur en intelligence artificielle formé entre Nairobi et Londres, Samuel Otieno dirige aujourd'hui un institut de recherche appliquée qui travaille avec des gouvernements et des entreprises sur l'adoption responsable de l'IA et la souveraineté des données. Ses interventions couvrent l'infrastructure numérique du continent, la régulation de l'IA et les compétences technologiques de la prochaine génération.",
    pillarSlug: 'innovation-digital-continent',
    formatSlugs: ['keynote', 'panellist', 'workshop'],
    languageCodes: ['en', 'sw'],
    isFeaturedHome: true,
    isTopRequested: true,
    showBudget: true,
    feeTierPublic: 'TIER_3',
    withPhoto: true,
    withEngagement: {
      eventName: 'Africa AI & Data Sovereignty Summit',
      organization: 'Digital Africa Coalition',
      dateLabel: '2025',
      role: 'Conférencier principal',
      topic: "Souveraineté des données et adoption responsable de l'IA",
      description:
        'Keynote sur les choix de politique publique qui détermineront qui bénéficie de la révolution IA en Afrique.',
    },
  },
  {
    slug: 'fatoumata-diarra',
    firstName: 'Fatoumata',
    lastName: 'Diarra',
    status: 'PUBLISHED',
    countryName: 'Mali',
    city: 'Bamako',
    professionalTitle: 'Climate Scientist & Public Health Advisor',
    currentOrganization: 'Sahel Climate Resilience Network',
    shortBio:
      "Fatoumata Diarra étudie les impacts du changement climatique sur la santé publique au Sahel et conseille les ministères sur les stratégies d'adaptation.",
    fullBio:
      "Climatologue de formation, Fatoumata Diarra a consacré sa carrière à l'intersection entre changement climatique et santé publique au Sahel. Elle conseille plusieurs ministères de la santé sur les stratégies d'adaptation et intervient régulièrement sur le financement de la résilience climatique communautaire.",
    pillarSlug: 'health-climate-social-progress',
    formatSlugs: ['keynote', 'panellist', 'advisor'],
    languageCodes: ['fr', 'en'],
    isFeaturedHome: false,
    isTopRequested: false,
    showBudget: true,
    feeTierPublic: 'TIER_2',
    withPhoto: true,
    withEngagement: {
      eventName: 'Sahel Climate & Health Forum',
      organization: 'Regional Ministries of Health Coalition',
      dateLabel: '2024',
      role: 'Panéliste',
      topic: 'Adapter la santé publique au changement climatique',
      description:
        'Panel sur le financement de la résilience climatique communautaire dans les systèmes de santé du Sahel.',
    },
  },
  {
    slug: 'kwabena-asante',
    firstName: 'Kwabena',
    lastName: 'Asante',
    status: 'PUBLISHED',
    countryName: 'Ghana',
    city: 'Accra',
    professionalTitle: 'Former Olympic Coach & Youth Development Advocate',
    currentOrganization: 'Golden Generation Sports Academy',
    shortBio:
      "Kwabena Asante a entraîné des athlètes olympiques ghanéens et dirige aujourd'hui une académie sportive dédiée au développement de la jeunesse.",
    fullBio:
      "Ancien entraîneur olympique, Kwabena Asante a accompagné plusieurs générations d'athlètes ghanéens jusqu'aux plus hauts niveaux internationaux. Il dirige aujourd'hui une académie sportive qui combine performance athlétique et développement personnel pour des milliers de jeunes chaque année. Ses interventions portent sur le leadership sous pression et la discipline comme moteur de réussite.",
    pillarSlug: 'sport-youth-next-generation',
    formatSlugs: ['keynote', 'masterclass-facilitator', 'fireside-chat'],
    languageCodes: ['en'],
    isFeaturedHome: false,
    isTopRequested: false,
    showBudget: false,
    feeTierPublic: 'TIER_1',
    withPhoto: true,
    withEngagement: {
      eventName: 'Continental Youth & Sport Forum',
      organization: 'African Sports Development Network',
      dateLabel: '2023',
      role: 'Intervenant en fireside chat',
      topic: 'Le leadership sous pression',
      description:
        "Conversation sur les leçons de l'entraînement olympique appliquées au développement des jeunes.",
    },
  },
  {
    slug: 'rahma-aziz',
    firstName: 'Rahma',
    lastName: 'Aziz',
    status: 'PUBLISHED',
    countryName: 'Morocco',
    city: 'Casablanca',
    professionalTitle: 'Fintech Founder & Financial Inclusion Advocate',
    currentOrganization: 'Atlas Pay',
    shortBio:
      "Rahma Aziz a fondé une plateforme de paiement mobile aujourd'hui présente dans quatre pays et parle d'inclusion financière et de scaling en Afrique du Nord.",
    fullBio:
      "Rahma Aziz a fondé Atlas Pay pour résoudre un problème qu'elle a vécu personnellement : l'accès limité aux services financiers dans les zones rurales du Maghreb. La plateforme opère aujourd'hui dans quatre pays. Elle intervient sur la levée de fonds pour les fintechs africaines, la régulation des paiements mobiles et l'inclusion financière comme moteur de croissance économique.",
    pillarSlug: 'enterprise-prosperity',
    formatSlugs: ['keynote', 'panellist', 'one-to-one-session'],
    languageCodes: ['fr', 'ar', 'en'],
    isFeaturedHome: false,
    isTopRequested: true,
    showBudget: true,
    feeTierPublic: 'TIER_2',
    withPhoto: true,
    withEngagement: {
      eventName: 'North Africa Fintech Forum',
      organization: 'Maghreb Digital Finance Council',
      dateLabel: '2025',
      role: 'Conférencière principale',
      topic: "L'inclusion financière comme moteur de croissance",
      description:
        "Keynote sur le scaling d'une fintech à travers plusieurs marchés nord-africains.",
    },
  },
  // --- Brouillons (2) — profils bien avancés mais jamais soumis à revue ---
  {
    slug: 'daniel-mwangi',
    firstName: 'Daniel',
    lastName: 'Mwangi',
    status: 'DRAFT',
    countryName: 'Kenya',
    city: 'Nairobi',
    professionalTitle: 'Cloud Infrastructure Executive',
    currentOrganization: 'Savannah Cloud Systems',
    shortBio:
      "Daniel Mwangi dirige l'un des principaux fournisseurs d'infrastructure cloud d'Afrique de l'Est et parle de résilience numérique et de souveraineté des données.",
    fullBio: null,
    pillarSlug: 'innovation-digital-continent',
    formatSlugs: ['keynote', 'workshop'],
    languageCodes: ['en', 'sw'],
    isFeaturedHome: false,
    isTopRequested: false,
    showBudget: false,
    feeTierPublic: null,
    withPhoto: true,
    withEngagement: null,
  },
  {
    slug: 'chioma-eze',
    firstName: 'Chioma',
    lastName: 'Eze',
    status: 'DRAFT',
    countryName: 'Nigeria',
    city: 'Abuja',
    professionalTitle: 'Broadcast Executive & Media Strategist',
    currentOrganization: 'Continental Broadcast Network',
    shortBio:
      "Chioma Eze pilote la stratégie éditoriale d'un grand réseau audiovisuel panafricain et intervient sur l'avenir des médias sur le continent.",
    fullBio: null,
    pillarSlug: 'culture-narrative-media',
    formatSlugs: ['moderator', 'panellist'],
    languageCodes: ['en'],
    isFeaturedHome: false,
    isTopRequested: false,
    showBudget: false,
    feeTierPublic: null,
    withPhoto: false,
    withEngagement: null,
  },
  // --- En attente de validation (1) — profil complet, jamais encore publié ---
  {
    slug: 'ibrahim-conte',
    firstName: 'Ibrahim',
    lastName: 'Conté',
    status: 'PENDING_VALIDATION',
    countryName: 'Guinea',
    city: 'Conakry',
    professionalTitle: 'Economist & Regional Trade Advisor',
    currentOrganization: 'Mano River Economic Institute',
    shortBio:
      "Ibrahim Conté conseille les institutions régionales sur l'intégration économique et les politiques commerciales en Afrique de l'Ouest.",
    fullBio:
      "Économiste spécialisé dans l'intégration régionale, Ibrahim Conté conseille institutions et gouvernements sur les politiques commerciales et l'harmonisation économique en Afrique de l'Ouest. Il vient de soumettre son profil pour intégrer le roster ASB.",
    pillarSlug: 'governance-african-voice',
    formatSlugs: ['panellist', 'advisor'],
    languageCodes: ['fr', 'en'],
    isFeaturedHome: false,
    isTopRequested: false,
    showBudget: false,
    feeTierPublic: null,
    withPhoto: true,
    withEngagement: null,
  },
  // --- Profil incomplet (1) — à peine commencé ---
  {
    slug: 'zanele-khumalo',
    firstName: 'Zanele',
    lastName: 'Khumalo',
    status: 'INCOMPLETE',
    countryName: 'South Africa',
    city: null,
    professionalTitle: null,
    currentOrganization: null,
    shortBio: null,
    fullBio: null,
    pillarSlug: null,
    formatSlugs: [],
    languageCodes: [],
    isFeaturedHome: false,
    isTopRequested: false,
    showBudget: false,
    feeTierPublic: null,
    withPhoto: false,
    withEngagement: null,
  },
];

async function ensureSpeaker(
  def: DemoSpeakerDef,
): Promise<{ id: number; isNew: boolean }> {
  const expectedSlug = slugify(`${def.firstName} ${def.lastName}`);
  if (expectedSlug !== def.slug) {
    throw new Error(
      `[seed:demo-scenario] slug "${def.slug}" ne correspond pas à slugify("${def.firstName} ${def.lastName}") = "${expectedSlug}".`,
    );
  }

  const existing = await prisma.speaker.findUnique({
    where: { slug: def.slug },
    select: { id: true },
  });
  if (existing) {
    log(`speaker "${def.slug}" — existe déjà (#${existing.id}), ignoré.`);
    return { id: existing.id, isNew: false };
  }

  log(
    `speaker "${def.slug}" — ${dryRun ? 'SERAIT CRÉÉ' : 'création'} (statut ${def.status}).`,
  );
  if (dryRun) {
    return { id: -1, isNew: true };
  }

  let countryId: number | undefined;
  if (def.countryName) {
    const country = await prisma.country.findFirst({
      where: { name: def.countryName },
      select: { id: true },
    });
    if (!country) {
      throw new Error(
        `[seed:demo-scenario] pays "${def.countryName}" introuvable — lance "npm run seed" d'abord.`,
      );
    }
    countryId = country.id;
  }

  let pillarId: number | undefined;
  if (def.pillarSlug) {
    const pillar = await prisma.pillar.findFirst({
      where: { slug: def.pillarSlug },
      select: { id: true },
    });
    if (!pillar) {
      throw new Error(
        `[seed:demo-scenario] pilier "${def.pillarSlug}" introuvable — lance "npm run seed" d'abord.`,
      );
    }
    pillarId = pillar.id;
  }

  const formats = def.formatSlugs.length
    ? await prisma.format.findMany({
        where: { slug: { in: def.formatSlugs } },
        select: { id: true, slug: true },
      })
    : [];
  if (formats.length !== def.formatSlugs.length) {
    throw new Error(
      `[seed:demo-scenario] format(s) introuvable(s) pour "${def.slug}".`,
    );
  }

  const languages = def.languageCodes.length
    ? await prisma.language.findMany({
        where: { code: { in: def.languageCodes } },
        select: { id: true, code: true },
      })
    : [];
  if (languages.length !== def.languageCodes.length) {
    throw new Error(
      `[seed:demo-scenario] langue(s) introuvable(s) pour "${def.slug}".`,
    );
  }

  const publicName = `${def.firstName} ${def.lastName}`;
  const isPublished = def.status === 'PUBLISHED';

  const speaker = await prisma.speaker.create({
    data: {
      firstName: def.firstName,
      lastName: def.lastName,
      publicName,
      slug: def.slug,
      countryId,
      city: def.city,
      profilePhotoUrl: def.withPhoto
        ? `https://picsum.photos/seed/${def.slug}/600/600`
        : null,
      coverPhotoUrl: def.withPhoto
        ? `https://picsum.photos/seed/${def.slug}-cover/1200/400`
        : null,
      professionalTitle: def.professionalTitle,
      currentOrganization: def.currentOrganization,
      shortBio: def.shortBio,
      fullBio: def.fullBio,
      feeTierPublic: def.feeTierPublic ?? undefined,
      status: def.status,
      isVisible: isPublished,
      isFeaturedHome: def.isFeaturedHome,
      isTopRequested: def.isTopRequested,
      showBudget: def.showBudget,
      showLocation: true,
      allowIndexing: true,
      completionScore: 0, // recalculé ci-dessous une fois les relations posées
      publishedAt: isPublished ? daysAgo(90) : null,
    },
  });

  if (pillarId) {
    await prisma.speakerPillar.create({
      data: {
        speakerId: speaker.id,
        pillarId,
        isPrimary: true,
        displayOrder: 0,
      },
    });
  }
  if (formats.length) {
    await prisma.speakerFormat.createMany({
      data: formats.map((f) => ({ speakerId: speaker.id, formatId: f.id })),
    });
  }
  if (languages.length) {
    await prisma.speakerLanguage.createMany({
      data: def.languageCodes.map((code) => {
        const lang = languages.find((l) => l.code === code)!;
        return {
          speakerId: speaker.id,
          languageId: lang.id,
          proficiency: 'FLUENT' as const,
          canPresent: true,
          canQa: true,
          canModerate: false,
        };
      }),
    });
  }
  if (def.withEngagement) {
    await prisma.signatureEngagement.create({
      data: { speakerId: speaker.id, ...def.withEngagement, displayOrder: 0 },
    });
  }

  // Score de complétion approximatif, cohérent avec les champs réellement
  // remplis ci-dessus (mêmes poids que completion-score.util.ts, sans en
  // dépendre directement pour ne pas avoir à charger tout SpeakerDetailRow
  // ici) — un profil DRAFT/INCOMPLETE doit rester visiblement incomplet.
  let score = 10; // nom + nom public
  if (def.withPhoto) score += 20;
  if (def.professionalTitle) score += 10;
  if (def.shortBio) score += 15;
  if (def.fullBio) score += 10;
  if (pillarId) score += 10;
  if (formats.length) score += 5;
  if (languages.length) score += 5;
  if (def.feeTierPublic) score += 2;
  if (countryId) score += 3;
  if (def.withEngagement) score += 5;
  await prisma.speaker.update({
    where: { id: speaker.id },
    data: { completionScore: Math.min(100, score) },
  });

  return { id: speaker.id, isNew: true };
}

// =========================================================================
// 2. RÉVISION DE PROFIL — soumise, en attente, portant sur titre + bio.
//    Appliquée au speaker "yasmin-toure" (déjà publié).
// =========================================================================

async function ensureSpeakerRevision(speakerId: number): Promise<void> {
  if (speakerId < 0) {
    log('révision de profil — SERAIT CRÉÉE (yasmin-toure, titre + bio).');
    return;
  }
  const existing = await prisma.speakerRevision.findFirst({
    where: { speakerId, status: 'SUBMITTED' },
    select: { id: true },
  });
  if (existing) {
    log(`révision de profil — existe déjà (#${existing.id}), ignorée.`);
    return;
  }
  if (dryRun) {
    log('révision de profil — SERAIT CRÉÉE (yasmin-toure, titre + bio).');
    return;
  }
  const payload = {
    professionalTitle:
      'Senior Policy Advisor & Former Deputy Minister of Trade',
    fullBio:
      "Après quinze ans passés entre le secteur public et les organisations multilatérales, Yasmin Touré a récemment achevé un mandat de Ministre déléguée au Commerce, où elle a piloté la réforme du code des investissements de son pays. Elle accompagne aujourd'hui gouvernements, banques de développement et institutions régionales sur les réformes de gouvernance publique et de transparence budgétaire, et intervient régulièrement dans les grandes conférences panafricaines sur le rôle des institutions dans la trajectoire de développement du continent.",
  } satisfies Prisma.InputJsonValue;

  const revision = await prisma.speakerRevision.create({
    data: {
      speakerId,
      payload,
      status: 'SUBMITTED',
      activeGuard: speakerId,
      submittedAt: daysAgo(2),
    },
  });
  log(`révision de profil — créée (#${revision.id}).`);
}

// =========================================================================
// 3. ORGANISATIONS & CONTACTS CLIENTS (2 organisations, plusieurs demandes)
// =========================================================================

interface DemoOrgDef {
  name: string;
  sector: string;
  countryName: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string;
  };
}

const DEMO_ORGS: DemoOrgDef[] = [
  {
    name: 'Meridian Growth Partners',
    sector: 'Financial Services',
    countryName: 'Nigeria',
    contact: {
      firstName: 'Adaeze',
      lastName: 'Nwosu',
      email: 'adaeze.nwosu@meridiangrowthpartners.test',
      jobTitle: 'Head of Partnerships & Events',
    },
  },
  {
    name: 'Sahel Renewable Energy Forum',
    sector: 'Events / Non-profit',
    countryName: 'Senegal',
    contact: {
      firstName: 'Moussa',
      lastName: 'Ba',
      email: 'moussa.ba@sahelenergyforum.test',
      jobTitle: 'Program Director',
    },
  },
];

async function ensureOrgAndContact(
  def: DemoOrgDef,
  adminId: number,
): Promise<{ orgId: number; contactId: number }> {
  let orgId: number;
  const existingOrg = await prisma.organization.findFirst({
    where: { name: def.name, deletedAt: null },
    select: { id: true },
  });
  if (existingOrg) {
    log(
      `organisation "${def.name}" — existe déjà (#${existingOrg.id}), ignorée.`,
    );
    orgId = existingOrg.id;
  } else {
    log(
      `organisation "${def.name}" — ${dryRun ? 'SERAIT CRÉÉE' : 'création'}.`,
    );
    if (dryRun) {
      orgId = -1;
    } else {
      const country = await prisma.country.findFirst({
        where: { name: def.countryName },
        select: { id: true },
      });
      const org = await prisma.organization.create({
        data: {
          name: def.name,
          sector: def.sector,
          countryId: country?.id,
          assignedAdminId: adminId,
        },
      });
      orgId = org.id;
    }
  }

  const normalizedEmail = def.contact.email.trim().toLowerCase();
  let contactId: number;
  const existingContact = await prisma.contact.findFirst({
    where: { normalizedEmail },
    select: { id: true },
  });
  if (existingContact) {
    log(
      `contact "${def.contact.email}" — existe déjà (#${existingContact.id}), ignoré.`,
    );
    contactId = existingContact.id;
  } else {
    log(
      `contact "${def.contact.email}" — ${dryRun ? 'SERAIT CRÉÉ' : 'création'}.`,
    );
    if (dryRun) {
      contactId = -1;
    } else {
      const contact = await prisma.contact.create({
        data: {
          firstName: def.contact.firstName,
          lastName: def.contact.lastName,
          email: def.contact.email,
          normalizedEmail,
          jobTitle: def.contact.jobTitle,
          organizationId: orgId > 0 ? orgId : undefined,
        },
      });
      contactId = contact.id;
    }
  }

  return { orgId, contactId };
}

// =========================================================================
// 4. DEMANDES CLIENTS (7) — 2 nouvelles, 1 en retard, 1 confirmée avec
//    speaker retenu, 3 autres à des statuts variés. Les 3 premières restent
//    volontairement NON rattachées à une fiche CRM (matière pour une
//    démonstration en direct du rattachement) ; les 4 suivantes sont déjà
//    rattachées aux 2 organisations ci-dessus.
// =========================================================================

interface DemoBookingRequestDef {
  key: string; // repère interne au script, jamais persisté
  serviceType: 'CONFERENCE' | 'MASTERCLASS' | 'WEBINAR' | 'ADVISORY';
  status: BookingStatus;
  priority: BookingPriority;
  fullName: string;
  organizationText: string;
  workEmail: string;
  eventName: string;
  eventFormat: string;
  eventDate: Date;
  audienceSize?: string;
  primaryTopics: string;
  createdAt: Date;
  responseDueAt: Date;
  firstRespondedAt: Date | null;
  assignedAdminId?: number;
  linkedOrgKey?: 'meridian' | 'sahel';
  source: BookingRequestSource;
}

function buildBookingRequests(
  adminId: number,
  orgIds: Record<'meridian' | 'sahel', number>,
  contactIds: Record<'meridian' | 'sahel', number>,
): DemoBookingRequestDef[] {
  return [
    {
      key: 'fresh-1',
      serviceType: 'CONFERENCE',
      status: 'NEW',
      priority: 'NORMAL',
      fullName: 'Grace Mensah',
      organizationText: 'BrightPath Consulting',
      workEmail: 'grace.mensah@brightpathconsulting.test',
      eventName: 'Women in Leadership Summit',
      eventFormat: 'In-Person',
      eventDate: daysFromNow(60),
      audienceSize: '250',
      primaryTopics: "Leadership au féminin, gouvernance d'entreprise",
      createdAt: hoursAgo(2),
      responseDueAt: daysFromNow(2),
      firstRespondedAt: null,
      source: 'PUBLIC_FORM',
    },
    {
      key: 'fresh-2',
      serviceType: 'WEBINAR',
      status: 'NEW',
      priority: 'NORMAL',
      fullName: 'Thierry Kouassi',
      organizationText: 'Pan-Africa Tech Alliance',
      workEmail: 't.kouassi@panafricatech.test',
      eventName: 'Digital Economy Webinar Series',
      eventFormat: 'Virtual',
      eventDate: daysFromNow(21),
      audienceSize: '600',
      primaryTopics: 'Économie numérique et souveraineté des données',
      createdAt: daysAgo(1),
      responseDueAt: daysFromNow(4),
      firstRespondedAt: null,
      source: 'PUBLIC_FORM',
    },
    {
      key: 'overdue',
      serviceType: 'MASTERCLASS',
      status: 'NEW',
      priority: 'HIGH',
      fullName: 'Ngozi Chukwu',
      organizationText: 'Vertex Holdings',
      workEmail: 'ngozi.chukwu@vertexholdings.test',
      eventName: 'Executive Leadership Masterclass',
      eventFormat: 'In-Person',
      eventDate: daysFromNow(40),
      audienceSize: '80',
      primaryTopics: 'Leadership exécutif en période de transformation',
      createdAt: daysAgo(6),
      responseDueAt: daysAgo(2),
      firstRespondedAt: null,
      source: 'PUBLIC_FORM',
    },
    {
      key: 'meridian-analysis',
      serviceType: 'CONFERENCE',
      status: 'UNDER_ANALYSIS',
      priority: 'NORMAL',
      fullName: 'Adaeze Nwosu',
      organizationText: 'Meridian Growth Partners',
      workEmail: 'adaeze.nwosu@meridiangrowthpartners.test',
      eventName: 'Meridian Investor Forum 2026',
      eventFormat: 'Hybrid',
      eventDate: daysFromNow(75),
      audienceSize: '300',
      primaryTopics: 'Investissement en infrastructure, énergie',
      createdAt: daysAgo(4),
      responseDueAt: daysFromNow(1),
      firstRespondedAt: daysAgo(3),
      assignedAdminId: adminId,
      linkedOrgKey: 'meridian',
      source: 'MANUAL_ENTRY',
    },
    {
      key: 'sahel-selecting',
      serviceType: 'CONFERENCE',
      status: 'SELECTING_SPEAKERS',
      priority: 'NORMAL',
      fullName: 'Moussa Ba',
      organizationText: 'Sahel Renewable Energy Forum',
      workEmail: 'moussa.ba@sahelenergyforum.test',
      eventName: 'Sahel Renewable Energy Forum 2026',
      eventFormat: 'In-Person',
      eventDate: daysFromNow(90),
      audienceSize: '450',
      primaryTopics: 'Énergie renouvelable, financement climat',
      createdAt: daysAgo(10),
      responseDueAt: daysAgo(8),
      firstRespondedAt: daysAgo(9),
      assignedAdminId: adminId,
      linkedOrgKey: 'sahel',
      source: 'MANUAL_ENTRY',
    },
    {
      key: 'sahel-negotiating',
      serviceType: 'ADVISORY',
      status: 'NEGOTIATING',
      priority: 'NORMAL',
      fullName: 'Moussa Ba',
      organizationText: 'Sahel Renewable Energy Forum',
      workEmail: 'moussa.ba@sahelenergyforum.test',
      eventName: 'Sahel Energy Policy Advisory Retainer',
      eventFormat: 'Ongoing Retainer',
      eventDate: daysFromNow(30),
      primaryTopics: 'Conseil politique énergie régionale',
      createdAt: daysAgo(15),
      responseDueAt: daysAgo(13),
      firstRespondedAt: daysAgo(14),
      assignedAdminId: adminId,
      linkedOrgKey: 'sahel',
      source: 'MANUAL_ENTRY',
    },
    {
      key: 'meridian-confirmed',
      serviceType: 'CONFERENCE',
      status: 'CONFIRMED',
      priority: 'HIGH',
      fullName: 'Adaeze Nwosu',
      organizationText: 'Meridian Growth Partners',
      workEmail: 'adaeze.nwosu@meridiangrowthpartners.test',
      eventName: 'Meridian Annual Leadership Conference',
      eventFormat: 'In-Person',
      eventDate: daysFromNow(45),
      audienceSize: '400',
      primaryTopics:
        'Investissement en infrastructure et transition énergétique',
      createdAt: daysAgo(21),
      responseDueAt: daysAgo(19),
      firstRespondedAt: daysAgo(20),
      assignedAdminId: adminId,
      linkedOrgKey: 'meridian',
      source: 'MANUAL_ENTRY',
    },
  ].map((def) => {
    if (def.linkedOrgKey) {
      return def;
    }
    return def;
  }) as DemoBookingRequestDef[];
  // (orgIds/contactIds appliqués dans ensureBookingRequest ci-dessous, pas
  // ici -- gardés en paramètres pour rester visibles à l'appelant)
  void orgIds;
  void contactIds;
}

async function ensureBookingRequest(
  def: DemoBookingRequestDef,
  orgIds: Record<'meridian' | 'sahel', number>,
  contactIds: Record<'meridian' | 'sahel', number>,
  adminId: number,
): Promise<{ id: number; isNew: boolean }> {
  const existing = await prisma.bookingRequest.findFirst({
    where: { workEmail: def.workEmail, eventName: def.eventName },
    select: { id: true },
  });
  if (existing) {
    log(`demande "${def.eventName}" — existe déjà (#${existing.id}), ignorée.`);
    return { id: existing.id, isNew: false };
  }

  log(
    `demande "${def.eventName}" — ${dryRun ? 'SERAIT CRÉÉE' : 'création'} (statut ${def.status}).`,
  );
  if (dryRun) {
    return { id: -1, isNew: true };
  }

  const organizationId = def.linkedOrgKey
    ? orgIds[def.linkedOrgKey]
    : undefined;
  const contactId = def.linkedOrgKey ? contactIds[def.linkedOrgKey] : undefined;

  const created = await createWithUniqueReference({
    prefix: 'ASB',
    countForYear: (year) =>
      prisma.bookingRequest.count({
        where: { reference: { startsWith: `ASB-${year}-` } },
      }),
    attemptCreate: (reference) =>
      prisma.bookingRequest.create({
        data: {
          reference,
          serviceType: def.serviceType,
          status: def.status,
          priority: def.priority,
          fullName: def.fullName,
          organization: def.organizationText,
          workEmail: def.workEmail,
          eventName: def.eventName,
          eventDate: def.eventDate,
          eventLocation: def.eventFormat === 'Virtual' ? 'Virtual' : undefined,
          eventFormat: def.eventFormat,
          audienceSize: def.audienceSize,
          primaryTopics: def.primaryTopics,
          source: def.source,
          responseDueAt: def.responseDueAt,
          firstRespondedAt: def.firstRespondedAt,
          assignedAdminId: def.assignedAdminId,
          contactId,
          organizationId,
          createdAt: def.createdAt,
        },
      }),
  });

  await prisma.activityLog.create({
    data: {
      actorId: adminId,
      action:
        def.source === 'MANUAL_ENTRY'
          ? 'booking_request.created_manually'
          : 'booking_request.created',
      entityType: 'BookingRequest',
      entityId: created.id,
      newValue: { reference: created.reference, status: def.status },
      createdAt: def.createdAt,
    },
  });
  if (def.status !== 'NEW') {
    await prisma.activityLog.create({
      data: {
        actorId: adminId,
        action: 'booking_request.status_changed',
        entityType: 'BookingRequest',
        entityId: created.id,
        oldValue: { status: 'NEW' },
        newValue: { status: def.status },
        createdAt: def.firstRespondedAt ?? def.createdAt,
      },
    });
  }

  return { id: created.id, isNew: true };
}

// =========================================================================
// 5. SÉLECTION DE SPEAKERS SUR UNE DEMANDE (booking_request_speakers)
// =========================================================================

async function ensureBookingRequestSpeaker(
  requestId: number,
  speakerId: number,
  status: BookingRequestSpeakerStatus,
  displayOrder: number,
  adminId: number,
): Promise<{ id: number; isNew: boolean }> {
  if (requestId < 0 || speakerId < 0) {
    log(
      `sélection speaker#${speakerId} sur demande#${requestId} — SERAIT CRÉÉE (${status}).`,
    );
    return { id: -1, isNew: true };
  }
  const existing = await prisma.bookingRequestSpeaker.findFirst({
    where: { requestId, speakerId },
    select: { id: true },
  });
  if (existing) {
    log(
      `sélection speaker#${speakerId} sur demande#${requestId} — existe déjà, ignorée.`,
    );
    return { id: existing.id, isNew: false };
  }
  log(
    `sélection speaker#${speakerId} sur demande#${requestId} — ${dryRun ? 'SERAIT CRÉÉE' : 'création'} (${status}).`,
  );
  if (dryRun) {
    return { id: -1, isNew: true };
  }
  const row = await prisma.bookingRequestSpeaker.create({
    data: {
      requestId,
      speakerId,
      status,
      displayOrder,
      addedById: adminId,
      proposedToClientAt:
        status === 'PROPOSED_TO_CLIENT' || status === 'SELECTED'
          ? daysAgo(5)
          : undefined,
    },
  });
  return { id: row.id, isNew: true };
}

// =========================================================================
// 6. CANDIDATURES (roster applications) — 1 nouvelle, 1 évaluée par 2
//    administrateurs, 1 approuvée prête à convertir (JAMAIS convertie ici).
// =========================================================================

interface DemoRosterAppDef {
  key: string;
  fullName: string;
  workEmail: string;
  country: string;
  expertiseArea: string;
  keyTopics: string;
  message: string;
  status: ApplicationStatus;
  createdAt: Date;
}

const DEMO_ROSTER_APPS: DemoRosterAppDef[] = [
  {
    key: 'new',
    fullName: 'Tendai Moyo',
    workEmail: 'tendai.moyo@personalmail.test',
    country: 'Zimbabwe',
    expertiseArea: 'Renewable Energy Policy',
    keyTopics: 'Politique énergétique, transition juste',
    message:
      'Je souhaite rejoindre le roster ASB pour partager mon expérience de la réforme du secteur électrique en Afrique australe.',
    status: 'NEW',
    createdAt: daysAgo(3),
  },
  {
    key: 'evaluated',
    fullName: 'Aminata Sow',
    workEmail: 'aminata.sow@personalmail.test',
    country: 'Senegal',
    expertiseArea: 'Gender Equity & Social Innovation',
    keyTopics: 'Équité de genre, innovation sociale, entrepreneuriat',
    message:
      "Consultante en innovation sociale, je conseille depuis dix ans des organisations panafricaines sur l'inclusion et l'équité de genre.",
    status: 'UNDER_REVIEW',
    createdAt: daysAgo(12),
  },
  {
    key: 'approved',
    fullName: 'Kwesi Boateng',
    workEmail: 'kwesi.boateng@personalmail.test',
    country: 'Ghana',
    expertiseArea: 'Trade & Regional Integration',
    keyTopics: 'Commerce régional, intégration économique',
    message:
      "Ancien négociateur commercial, j'interviens aujourd'hui sur l'intégration économique régionale et la Zone de libre-échange continentale africaine.",
    status: 'APPROVED',
    createdAt: daysAgo(18),
  },
];

async function ensureRosterApplication(
  def: DemoRosterAppDef,
  adminId: number,
): Promise<{ id: number; isNew: boolean }> {
  const existing = await prisma.rosterApplication.findFirst({
    where: { workEmail: def.workEmail },
    select: { id: true },
  });
  if (existing) {
    log(
      `candidature "${def.fullName}" — existe déjà (#${existing.id}), ignorée.`,
    );
    return { id: existing.id, isNew: false };
  }
  log(
    `candidature "${def.fullName}" — ${dryRun ? 'SERAIT CRÉÉE' : 'création'} (statut ${def.status}).`,
  );
  if (dryRun) {
    return { id: -1, isNew: true };
  }

  const created = await createWithUniqueReference({
    prefix: 'APP',
    countForYear: (year) =>
      prisma.rosterApplication.count({
        where: { reference: { startsWith: `APP-${year}-` } },
      }),
    attemptCreate: (reference) =>
      prisma.rosterApplication.create({
        data: {
          reference,
          fullName: def.fullName,
          workEmail: def.workEmail,
          country: def.country,
          expertiseArea: def.expertiseArea,
          keyTopics: def.keyTopics,
          message: def.message,
          status: def.status,
          statusChangedAt: def.status !== 'NEW' ? def.createdAt : undefined,
          assignedAdminId: def.status !== 'NEW' ? adminId : undefined,
          gdprConsent: true,
          createdAt: def.createdAt,
        },
      }),
  });

  await prisma.activityLog.create({
    data: {
      actorId: adminId,
      action: 'roster_application.created',
      entityType: 'RosterApplication',
      entityId: created.id,
      newValue: { reference: created.reference },
      createdAt: def.createdAt,
    },
  });

  return { id: created.id, isNew: true };
}

async function ensureEvaluation(
  applicationId: number,
  evaluatorId: number,
  scores: Record<string, number>,
  comment: string,
): Promise<void> {
  if (applicationId < 0 || evaluatorId < 0) {
    log(
      `évaluation candidature#${applicationId} par admin#${evaluatorId} — SERAIT CRÉÉE.`,
    );
    return;
  }
  const existing = await prisma.rosterApplicationEvaluation.findUnique({
    where: { applicationId_evaluatorId: { applicationId, evaluatorId } },
    select: { id: true },
  });
  if (existing) {
    log(
      `évaluation candidature#${applicationId} par admin#${evaluatorId} — existe déjà, ignorée.`,
    );
    return;
  }
  log(
    `évaluation candidature#${applicationId} par admin#${evaluatorId} — ${dryRun ? 'SERAIT CRÉÉE' : 'création'}.`,
  );
  if (dryRun) return;
  await prisma.rosterApplicationEvaluation.create({
    data: {
      applicationId,
      evaluatorId,
      expertiseLevel: scores.expertiseLevel,
      professionalCredibility: scores.professionalCredibility,
      stageExperience: scores.stageExperience,
      speakingQuality: scores.speakingQuality,
      internationalRelevance: scores.internationalRelevance,
      languageProficiency: scores.languageProficiency,
      mediaQuality: scores.mediaQuality,
      pillarFit: scores.pillarFit,
      commercialPotential: scores.commercialPotential,
      comment,
    },
  });
}

// =========================================================================
// 7. SECOND ADMINISTRATEUR (nécessaire pour "évaluée par deux
//    administrateurs" — un seul admin ne peut évaluer qu'une fois).
// =========================================================================

async function ensureSecondAdmin(): Promise<{ id: number; isNew: boolean }> {
  const email = 'fatou.cisse@africaspeakersbureau.com';
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    log(`administratrice "${email}" — existe déjà (#${existing.id}), ignorée.`);
    return { id: existing.id, isNew: false };
  }
  log(
    `administratrice "${email}" — ${dryRun ? 'SERAIT CRÉÉE' : 'création'} (ADMIN).`,
  );
  if (dryRun) {
    return { id: -1, isNew: true };
  }
  const user = await prisma.user.create({
    data: {
      email,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'Fatou',
      lastName: 'Cissé',
    },
  });
  return { id: user.id, isNew: true };
}

// =========================================================================
// 8. SOLLICITATIONS DE DISPONIBILITÉ (2) — une envoyée, une répondue.
// =========================================================================

async function ensureAvailabilityRequest(params: {
  bookingRequestId: number;
  speakerId: number;
  sentById: number;
  status: AvailabilityRequestStatus;
  sentAt: Date;
  respondDueAt: Date;
  eventType: string;
  eventDate: Date;
  topic: string;
  proposedFeeAmount: number;
  proposedFeeCurrency: string;
  responseStatus?: AvailabilityResponseStatus;
  respondedAt?: Date;
  speakerPrivateComment?: string;
}): Promise<void> {
  if (params.bookingRequestId < 0 || params.speakerId < 0) {
    log(
      `sollicitation de disponibilité (demande#${params.bookingRequestId}, speaker#${params.speakerId}) — SERAIT CRÉÉE (${params.status}).`,
    );
    return;
  }
  const existing = await prisma.availabilityRequest.findFirst({
    where: {
      bookingRequestId: params.bookingRequestId,
      speakerId: params.speakerId,
    },
    select: { id: true },
  });
  if (existing) {
    log(
      `sollicitation de disponibilité (demande#${params.bookingRequestId}, speaker#${params.speakerId}) — existe déjà, ignorée.`,
    );
    return;
  }
  log(
    `sollicitation de disponibilité (demande#${params.bookingRequestId}, speaker#${params.speakerId}) — ${dryRun ? 'SERAIT CRÉÉE' : 'création'} (${params.status}).`,
  );
  if (dryRun) return;

  const isTerminal = params.status !== 'SENT';
  await prisma.availabilityRequest.create({
    data: {
      bookingRequestId: params.bookingRequestId,
      speakerId: params.speakerId,
      sentById: params.sentById,
      sentAt: params.sentAt,
      respondDueAt: params.respondDueAt,
      status: params.status,
      eventType: params.eventType,
      eventDate: params.eventDate,
      topic: params.topic,
      proposedFeeAmount: params.proposedFeeAmount,
      proposedFeeCurrency: params.proposedFeeCurrency,
      responseStatus: params.responseStatus,
      respondedAt: params.respondedAt,
      speakerPrivateComment: params.speakerPrivateComment,
      activeGuard: isTerminal
        ? null
        : `${params.bookingRequestId}-${params.speakerId}`,
    },
  });
}

// =========================================================================
// 9. MISSION EN COURS — checklist à moitié, un document déposé.
// =========================================================================

async function ensureMission(params: {
  bookingRequestId: number;
  speakerId: number;
  organizationId?: number;
  contactId?: number;
  serviceType: string;
  eventDate: Date;
  topic: string;
  actorId: number;
}): Promise<void> {
  if (params.bookingRequestId < 0 || params.speakerId < 0) {
    log(
      `mission (demande#${params.bookingRequestId}, speaker#${params.speakerId}) — SERAIT CRÉÉE.`,
    );
    return;
  }
  const existing = await prisma.mission.findFirst({
    where: {
      bookingRequestId: params.bookingRequestId,
      speakerId: params.speakerId,
    },
    select: { id: true },
  });
  if (existing) {
    log(
      `mission (demande#${params.bookingRequestId}, speaker#${params.speakerId}) — existe déjà (#${existing.id}), ignorée.`,
    );
    return;
  }
  log(
    `mission (demande#${params.bookingRequestId}, speaker#${params.speakerId}) — ${dryRun ? 'SERAIT CRÉÉE' : 'création'}.`,
  );
  if (dryRun) return;

  const createdAt = daysAgo(18);
  const mission = await createWithUniqueReference({
    prefix: 'MSN',
    countForYear: (year) =>
      prisma.mission.count({
        where: { reference: { startsWith: `MSN-${year}-` } },
      }),
    attemptCreate: (reference) =>
      prisma.mission.create({
        data: {
          reference,
          bookingRequestId: params.bookingRequestId,
          speakerId: params.speakerId,
          organizationId: params.organizationId,
          contactId: params.contactId,
          serviceType:
            params.serviceType as Prisma.MissionUncheckedCreateInput['serviceType'],
          eventDate: params.eventDate,
          startTime: '09:00',
          endTime: '10:00',
          timezone: 'Africa/Lagos',
          locationCountryId: undefined,
          address: 'Eko Hotel & Suites, Victoria Island, Lagos',
          isVirtual: false,
          onSiteContactName: 'Adaeze Nwosu',
          onSiteContactPhone: '+234 801 234 5678',
          durationMinutes: 60,
          topic: params.topic,
          language: 'English',
          format: 'Keynote',
          participantCount: 400,
          clientAmount: 18000,
          speakerAmount: 12000,
          agencyCommission: 6000,
          expenses: 1200,
          currency: 'USD',
          status: MissionStatus.LOGISTICS_IN_PROGRESS,
          contractStatus: MissionContractStatus.SIGNED,
          paymentStatus: MissionPaymentStatus.DEPOSIT_RECEIVED,
          logisticsStatus: MissionLogisticsStatus.IN_PROGRESS,
          createdById: params.actorId,
          activeGuard: `${params.bookingRequestId}-${params.speakerId}`,
          createdAt,
        },
      }),
  });

  // §4 — 15 points instanciés, 8 cochés (~53%, "à moitié" — cf. prompt).
  const DONE_CODES = new Set([
    'availability_confirmed',
    'quote_sent',
    'quote_accepted',
    'contract_sent',
    'contract_signed',
    'deposit_requested',
    'deposit_received',
    'brief_sent',
  ]);
  await prisma.missionChecklistItem.createMany({
    data: MISSION_CHECKLIST_TEMPLATE.map((item) => ({
      missionId: mission.id,
      code: item.code,
      label: item.label,
      displayOrder: item.displayOrder,
      isDone: DONE_CODES.has(item.code),
      doneById: DONE_CODES.has(item.code) ? params.actorId : undefined,
      doneAt: DONE_CODES.has(item.code) ? daysAgo(10) : undefined,
    })),
  });

  await prisma.activityLog.create({
    data: {
      actorId: params.actorId,
      action: 'mission.created',
      entityType: 'Mission',
      entityId: mission.id,
      newValue: {
        bookingRequestId: params.bookingRequestId,
        speakerId: params.speakerId,
      },
      createdAt,
    },
  });
  for (const code of DONE_CODES) {
    const item = MISSION_CHECKLIST_TEMPLATE.find((i) => i.code === code)!;
    await prisma.activityLog.create({
      data: {
        actorId: params.actorId,
        action: 'mission_checklist_item.checked',
        entityType: 'Mission',
        entityId: mission.id,
        newValue: { code: item.code, label: item.label, isDone: true },
        createdAt: daysAgo(10),
      },
    });
  }

  // Document déposé — écriture réelle sur le disque de stockage (mêmes
  // conventions que MissionDocumentsService, voir en-tête du fichier) pour
  // que le téléchargement fonctionne vraiment pendant la démo.
  const pdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
  );
  const storageRoot = resolve(process.env.STORAGE_ROOT || './storage');
  const filename = `${randomUUID()}.pdf`;
  const storageKey = `private/${MISSION_DOCUMENT_SUBDIR}/${filename}`;
  const absolutePath = resolve(
    storageRoot,
    'private',
    MISSION_DOCUMENT_SUBDIR,
    filename,
  );
  await fsp.mkdir(resolve(absolutePath, '..'), { recursive: true });
  await fsp.writeFile(absolutePath, pdfBuffer);

  const document = await prisma.missionDocument.create({
    data: {
      missionId: mission.id,
      type: MissionDocumentType.BRIEF,
      uploadedById: params.actorId,
      uploadedByRole: Role.SUPER_ADMIN,
      isSharedWithSpeaker: true,
      storageKey,
      originalFilename: 'Brief_Meridian_Annual_Leadership_Conference.pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdfBuffer.length,
      createdAt: daysAgo(9),
    },
  });
  await prisma.activityLog.create({
    data: {
      actorId: params.actorId,
      action: 'mission_document.uploaded',
      entityType: 'Mission',
      entityId: mission.id,
      newValue: { documentId: document.id, type: 'BRIEF' },
      createdAt: daysAgo(9),
    },
  });

  log(
    `mission "${mission.reference}" — créée, checklist 8/15, document déposé.`,
  );
}

// =========================================================================
// ORCHESTRATION
// =========================================================================

async function main(): Promise<void> {
  log(dryRun ? 'DRY-RUN (aucune écriture)' : 'EXÉCUTION RÉELLE');

  const admin = await prisma.user.findFirst({
    where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
    orderBy: { id: 'asc' },
    select: { id: true, email: true },
  });
  if (!admin) {
    throw new Error(
      "[seed:demo-scenario] Aucun compte ADMIN/SUPER_ADMIN trouvé — le scénario a besoin d'un acteur pour les créations/journaux.",
    );
  }
  log(`acteur principal : ${admin.email} (#${admin.id})`);

  // --- 1. Speakers ---
  log('--- Speakers ---');
  const speakerIds: Record<string, number> = {};
  for (const def of DEMO_SPEAKERS) {
    const { id } = await ensureSpeaker(def);
    speakerIds[def.slug] = id;
  }

  // --- 2. Révision de profil ---
  log('--- Révision de profil ---');
  await ensureSpeakerRevision(speakerIds['yasmin-toure']);

  // --- 3. Organisations & contacts ---
  log('--- Organisations & contacts ---');
  const meridian = await ensureOrgAndContact(DEMO_ORGS[0], admin.id);
  const sahel = await ensureOrgAndContact(DEMO_ORGS[1], admin.id);
  const orgIds = { meridian: meridian.orgId, sahel: sahel.orgId };
  const contactIds = { meridian: meridian.contactId, sahel: sahel.contactId };

  // --- 4. Demandes clients ---
  log('--- Demandes clients ---');
  const bookingDefs = buildBookingRequests(admin.id, orgIds, contactIds);
  const bookingIds: Record<string, number> = {};
  for (const def of bookingDefs) {
    const { id } = await ensureBookingRequest(
      def,
      orgIds,
      contactIds,
      admin.id,
    );
    bookingIds[def.key] = id;
  }

  // --- 5. Sélections de speakers sur les demandes ---
  log('--- Sélection de speakers ---');
  await ensureBookingRequestSpeaker(
    bookingIds['sahel-selecting'],
    speakerIds['fatoumata-diarra'],
    'SHORTLISTED',
    0,
    admin.id,
  );
  await ensureBookingRequestSpeaker(
    bookingIds['sahel-selecting'],
    speakerIds['samuel-otieno'],
    'AVAILABILITY_REQUESTED',
    1,
    admin.id,
  );
  await ensureBookingRequestSpeaker(
    bookingIds['sahel-negotiating'],
    speakerIds['yasmin-toure'],
    'PROPOSED_TO_CLIENT',
    0,
    admin.id,
  );
  await ensureBookingRequestSpeaker(
    bookingIds['meridian-confirmed'],
    speakerIds['emeka-adeyemi'],
    'SELECTED',
    0,
    admin.id,
  );

  // --- 6. Candidatures + second administrateur ---
  log('--- Second administrateur ---');
  const secondAdmin = await ensureSecondAdmin();

  log('--- Candidatures ---');
  const rosterIds: Record<string, number> = {};
  for (const def of DEMO_ROSTER_APPS) {
    const { id } = await ensureRosterApplication(def, admin.id);
    rosterIds[def.key] = id;
  }
  await ensureEvaluation(
    rosterIds['evaluated'],
    admin.id,
    {
      expertiseLevel: 5,
      professionalCredibility: 5,
      stageExperience: 4,
      speakingQuality: 4,
      internationalRelevance: 4,
      languageProficiency: 5,
      mediaQuality: 3,
      pillarFit: 5,
      commercialPotential: 4,
    },
    "Excellente candidate, expertise rare sur l'équité de genre en Afrique de l'Ouest. Présence scénique à confirmer en entretien.",
  );
  await ensureEvaluation(
    rosterIds['evaluated'],
    secondAdmin.id,
    {
      expertiseLevel: 4,
      professionalCredibility: 4,
      stageExperience: 3,
      speakingQuality: 4,
      internationalRelevance: 4,
      languageProficiency: 4,
      mediaQuality: 3,
      pillarFit: 4,
      commercialPotential: 4,
    },
    "D'accord avec l'évaluation générale. Profil solide, à positionner sur les pilliers Gouvernance et Santé/Climat.",
  );

  // --- 7. Sollicitations de disponibilité ---
  log('--- Sollicitations de disponibilité ---');
  await ensureAvailabilityRequest({
    bookingRequestId: bookingIds['sahel-selecting'],
    speakerId: speakerIds['samuel-otieno'],
    sentById: admin.id,
    status: 'SENT',
    sentAt: daysAgo(2),
    respondDueAt: daysFromNow(3),
    eventType: 'Conference',
    eventDate: daysFromNow(90),
    topic: 'Souveraineté des données et infrastructure numérique',
    proposedFeeAmount: 8000,
    proposedFeeCurrency: 'USD',
  });
  await ensureAvailabilityRequest({
    bookingRequestId: bookingIds['sahel-negotiating'],
    speakerId: speakerIds['yasmin-toure'],
    sentById: admin.id,
    status: 'RESPONDED',
    sentAt: daysAgo(6),
    respondDueAt: daysAgo(1),
    eventType: 'Advisory',
    eventDate: daysFromNow(30),
    topic: 'Conseil politique énergie régionale',
    proposedFeeAmount: 5000,
    proposedFeeCurrency: 'USD',
    responseStatus: 'AVAILABLE_INTERESTED',
    respondedAt: daysAgo(1),
    speakerPrivateComment:
      'Disponible aux dates proposées, ravie de contribuer.',
  });

  // --- 8. Mission en cours ---
  log('--- Mission ---');
  await ensureMission({
    bookingRequestId: bookingIds['meridian-confirmed'],
    speakerId: speakerIds['emeka-adeyemi'],
    organizationId: orgIds.meridian > 0 ? orgIds.meridian : undefined,
    contactId: contactIds.meridian > 0 ? contactIds.meridian : undefined,
    serviceType: 'CONFERENCE',
    eventDate: daysFromNow(45),
    topic: 'Investissement en infrastructure et transition énergétique',
    actorId: admin.id,
  });

  log(
    dryRun
      ? 'DRY-RUN terminé — relance avec -- --execute pour écrire réellement.'
      : 'Terminé.',
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
