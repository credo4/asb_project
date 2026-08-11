// Consolidation avant la suite de la Phase 3, Partie F2 — profils de
// démonstration pour que le développeur du site public dispose d'une API
// non vide sur laquelle démarrer son intégration.
//
// Usage (depuis backend/) :
//   npm run seed:demo-speakers
//
// IDEMPOTENT : chaque profil est identifié par un slug FIXE (voir
// DEMO_SPEAKERS ci-dessous, pas de suffixe généré via resolveUniqueSlug —
// on veut retomber sur la même ligne à chaque exécution, pas une nouvelle).
// Le speaker est upserté par slug ; ses relations many-to-many (piliers,
// formats, langues) et ses temps forts (SignatureEngagement) sont
// remplacés en bloc (delete puis recreate) à chaque exécution — plus
// simple et tout aussi idempotent qu'un upsert relation par relation, et
// ça absorbe naturellement une évolution future du contenu de ce script
// (ex: ajouter une langue à un profil existant) sans rien devoir migrer.
//
// Mêmes conventions que les profils de démo créés manuellement en Phase 1
// (kwame-mensah, amara-diallo, toujours présents en local) : organisation
// se terminant par « (fictional demo profile) », photos via URL externe
// (picsum.photos, seed = slug), bio expliquant explicitement qu'il s'agit
// d'un profil fictif de démonstration.
import { PrismaClient, Prisma } from '@prisma/client';
import { slugify } from '../src/modules/speakers/slug.util';

const prisma = new PrismaClient();

interface DemoSpeakerDefinition {
  slug: string;
  firstName: string;
  lastName: string;
  professionalTitle: string;
  currentOrganization: string;
  city: string;
  countryName: string;
  shortBio: string;
  fullBio: string;
  feeTierPublic: 'TIER_1' | 'TIER_2' | 'TIER_3';
  showBudget: boolean;
  isFeaturedHome: boolean;
  isTopRequested: boolean;
  pillarSlug: string;
  formatSlugs: string[];
  languages: Array<{
    code: string;
    proficiency: 'NATIVE' | 'FLUENT' | 'PROFESSIONAL' | 'INTERMEDIATE';
  }>;
  engagement: {
    eventName: string;
    organization: string;
    dateLabel: string;
    role: string;
    topic: string;
    description: string;
  };
}

const DEMO_SPEAKERS: DemoSpeakerDefinition[] = [
  {
    slug: 'nadia-benali',
    firstName: 'Nadia',
    lastName: 'Benali',
    professionalTitle: 'Fintech Entrepreneur & Financial Inclusion Advocate',
    currentOrganization: 'Sahel Pay Group (fictional demo profile)',
    city: 'Lagos',
    countryName: 'Nigeria',
    shortBio:
      'Nadia Benali builds payment infrastructure for underbanked communities and speaks on financial inclusion, fintech regulation, and scaling ventures across African markets.',
    fullBio:
      'This is a fictional demo speaker profile created to give integrating developers a non-empty public API to work against. Nadia Benali founded a mobile-money platform now operating in six countries and advises regulators on digital-payments policy across the continent.',
    feeTierPublic: 'TIER_2',
    showBudget: true,
    isFeaturedHome: false,
    isTopRequested: false,
    pillarSlug: 'enterprise-prosperity',
    formatSlugs: ['keynote', 'panellist', 'executive-training'],
    languages: [
      { code: 'fr', proficiency: 'NATIVE' },
      { code: 'en', proficiency: 'FLUENT' },
    ],
    engagement: {
      eventName: 'Africa Fintech Summit',
      organization: 'Fintech Africa Council',
      dateLabel: '2025',
      role: 'Keynote Speaker',
      topic: 'Financial inclusion through mobile money',
      description:
        'Opening keynote on scaling digital payments infrastructure for unbanked populations.',
    },
  },
  {
    slug: 'thabo-nkosi',
    firstName: 'Thabo',
    lastName: 'Nkosi',
    professionalTitle:
      'Former National Team Captain & Youth Development Advocate',
    currentOrganization:
      'Continental Sports Foundation (fictional demo profile)',
    city: 'Johannesburg',
    countryName: 'South Africa',
    shortBio:
      'Thabo Nkosi is a former national team captain who now speaks on youth development through sport, leadership under pressure, and building the next generation of African athletes.',
    fullBio:
      'This is a fictional demo speaker profile created to give integrating developers a non-empty public API to work against. Thabo Nkosi captained his national team for eight years and now runs grassroots sport programs reaching thousands of young people annually.',
    feeTierPublic: 'TIER_1',
    showBudget: false,
    isFeaturedHome: true,
    isTopRequested: false,
    pillarSlug: 'sport-youth-next-generation',
    formatSlugs: ['keynote', 'fireside-chat', 'masterclass-facilitator'],
    languages: [{ code: 'en', proficiency: 'NATIVE' }],
    engagement: {
      eventName: 'Continental Youth & Sport Forum',
      organization: 'African Sports Development Network',
      dateLabel: '2024',
      role: 'Fireside Chat Guest',
      topic: 'Leadership under pressure, on and off the pitch',
      description:
        'Fireside conversation on translating captaincy lessons into youth leadership programs.',
    },
  },
  {
    slug: 'grace-wanjiru',
    firstName: 'Grace',
    lastName: 'Wanjiru',
    professionalTitle: 'Public Health Physician & Climate Resilience Advisor',
    currentOrganization:
      'East Africa Health Resilience Institute (fictional demo profile)',
    city: 'Nairobi',
    countryName: 'Kenya',
    shortBio:
      'Dr. Grace Wanjiru is a public health physician speaking on climate-resilient health systems, community health financing, and the intersection of climate change and disease burden in Africa.',
    fullBio:
      'This is a fictional demo speaker profile created to give integrating developers a non-empty public API to work against. Dr. Grace Wanjiru has led health-system resilience programs across East Africa and advises on climate adaptation strategy for public health ministries.',
    feeTierPublic: 'TIER_2',
    showBudget: true,
    isFeaturedHome: false,
    isTopRequested: true,
    pillarSlug: 'health-climate-social-progress',
    formatSlugs: ['keynote', 'panellist', 'workshop'],
    languages: [
      { code: 'en', proficiency: 'NATIVE' },
      { code: 'sw', proficiency: 'FLUENT' },
    ],
    engagement: {
      eventName: 'East Africa Climate & Health Conference',
      organization: 'Regional Ministries of Health Coalition',
      dateLabel: '2025',
      role: 'Panellist',
      topic: 'Climate-resilient health systems',
      description:
        'Panel discussion on adapting community health financing to a changing climate burden.',
    },
  },
];

async function main() {
  for (const def of DEMO_SPEAKERS) {
    // Slug FIXE volontairement, pas slugify(publicName) — voir l'en-tête
    // de fichier. On vérifie tout de même la cohérence à titre défensif :
    // un slug qui diverge du nom signalerait une faute de frappe dans
    // DEMO_SPEAKERS plutôt qu'un choix délibéré.
    const expectedSlug = slugify(`${def.firstName} ${def.lastName}`);
    if (expectedSlug !== def.slug) {
      throw new Error(
        `[seed:demo-speakers] slug "${def.slug}" ne correspond pas à slugify("${def.firstName} ${def.lastName}") = "${expectedSlug}" — corrige DEMO_SPEAKERS.`,
      );
    }

    const country = await prisma.country.findFirst({
      where: { name: def.countryName },
      select: { id: true },
    });
    if (!country) {
      throw new Error(
        `[seed:demo-speakers] pays "${def.countryName}" introuvable — la table countries a-t-elle été seedée (npm run seed) ?`,
      );
    }

    const pillar = await prisma.pillar.findFirst({
      where: { slug: def.pillarSlug },
      select: { id: true },
    });
    if (!pillar) {
      throw new Error(
        `[seed:demo-speakers] pilier "${def.pillarSlug}" introuvable — la table pillars a-t-elle été seedée (npm run seed) ?`,
      );
    }

    const formats = await prisma.format.findMany({
      where: { slug: { in: def.formatSlugs } },
      select: { id: true, slug: true },
    });
    if (formats.length !== def.formatSlugs.length) {
      const missing = def.formatSlugs.filter(
        (slug) => !formats.some((f) => f.slug === slug),
      );
      throw new Error(
        `[seed:demo-speakers] format(s) introuvable(s) pour "${def.slug}" : ${missing.join(', ')}`,
      );
    }

    const languages = await prisma.language.findMany({
      where: { code: { in: def.languages.map((l) => l.code) } },
      select: { id: true, code: true },
    });
    if (languages.length !== def.languages.length) {
      const missing = def.languages
        .map((l) => l.code)
        .filter((code) => !languages.some((l) => l.code === code));
      throw new Error(
        `[seed:demo-speakers] langue(s) introuvable(s) pour "${def.slug}" : ${missing.join(', ')}`,
      );
    }

    await prisma.$transaction(async (tx) => {
      const publicName = `${def.firstName} ${def.lastName}`;
      const speakerData: Prisma.SpeakerUncheckedCreateInput = {
        firstName: def.firstName,
        lastName: def.lastName,
        publicName,
        slug: def.slug,
        countryId: country.id,
        city: def.city,
        profilePhotoUrl: `https://picsum.photos/seed/${def.slug}/600/600`,
        coverPhotoUrl: `https://picsum.photos/seed/${def.slug}-cover/1200/400`,
        professionalTitle: def.professionalTitle,
        currentOrganization: def.currentOrganization,
        shortBio: def.shortBio,
        fullBio: def.fullBio,
        feeTierPublic: def.feeTierPublic,
        status: 'PUBLISHED',
        isVisible: true,
        isFeaturedHome: def.isFeaturedHome,
        isTopRequested: def.isTopRequested,
        showBudget: def.showBudget,
        showLocation: true,
        allowIndexing: true,
        completionScore: 95,
        publishedAt: new Date(),
      };

      const speaker = await tx.speaker.upsert({
        where: { slug: def.slug },
        update: speakerData,
        create: speakerData,
      });

      // Relations many-to-many : remplacées en bloc à chaque exécution
      // (delete puis recreate) — plus simple qu'un upsert relation par
      // relation et tout aussi idempotent en sortie (voir en-tête).
      await tx.speakerPillar.deleteMany({ where: { speakerId: speaker.id } });
      await tx.speakerPillar.create({
        data: {
          speakerId: speaker.id,
          pillarId: pillar.id,
          isPrimary: true,
          displayOrder: 0,
        },
      });

      await tx.speakerFormat.deleteMany({ where: { speakerId: speaker.id } });
      await tx.speakerFormat.createMany({
        data: formats.map((format) => ({
          speakerId: speaker.id,
          formatId: format.id,
        })),
      });

      await tx.speakerLanguage.deleteMany({ where: { speakerId: speaker.id } });
      await tx.speakerLanguage.createMany({
        data: def.languages.map((lang) => {
          const language = languages.find((l) => l.code === lang.code)!;
          return {
            speakerId: speaker.id,
            languageId: language.id,
            proficiency: lang.proficiency,
            canPresent: true,
            canQa: true,
            canModerate: lang.proficiency === 'NATIVE',
          };
        }),
      });

      await tx.signatureEngagement.deleteMany({
        where: { speakerId: speaker.id },
      });
      await tx.signatureEngagement.create({
        data: {
          speakerId: speaker.id,
          eventName: def.engagement.eventName,
          organization: def.engagement.organization,
          dateLabel: def.engagement.dateLabel,
          role: def.engagement.role,
          topic: def.engagement.topic,
          description: def.engagement.description,
          displayOrder: 0,
        },
      });

      console.log(`[seed:demo-speakers] OK — ${publicName} (${def.slug})`);
    });
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
