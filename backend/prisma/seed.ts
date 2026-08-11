import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const BCRYPT_COST_FACTOR = 12;

const prisma = new PrismaClient();

// -----------------------------------------------------------------------------
// Les 6 piliers (contenu éditorial minimal ; à enrichir en Phase 4 via le CMS).
// -----------------------------------------------------------------------------
const pillars = [
  { name: 'Governance & the African Voice', slug: 'governance-african-voice' },
  { name: 'Enterprise & Prosperity', slug: 'enterprise-prosperity' },
  {
    name: 'Innovation & the Digital Continent',
    slug: 'innovation-digital-continent',
  },
  { name: 'Culture, Narrative & Media', slug: 'culture-narrative-media' },
  {
    name: 'Health, Climate & Social Progress',
    slug: 'health-climate-social-progress',
  },
  {
    name: 'Sport, Youth & the Next Generation',
    slug: 'sport-youth-next-generation',
  },
];

const formats = [
  { name: 'Keynote', slug: 'keynote' },
  { name: 'Panellist', slug: 'panellist' },
  { name: 'Moderator', slug: 'moderator' },
  { name: 'Masterclass Facilitator', slug: 'masterclass-facilitator' },
  { name: 'Advisor', slug: 'advisor' },
  { name: 'One-to-One Session', slug: 'one-to-one-session' },
  { name: 'Webinar', slug: 'webinar' },
  { name: 'Workshop', slug: 'workshop' },
  { name: 'Executive Training', slug: 'executive-training' },
  { name: 'Fireside Chat', slug: 'fireside-chat' },
  { name: 'Hybrid Event', slug: 'hybrid-event' },
];

// Langues de départ (code ISO 639-1).
const languages = [
  { name: 'English', code: 'en' },
  { name: 'French', code: 'fr' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Arabic', code: 'ar' },
  { name: 'Swahili', code: 'sw' },
];

// Les 54 états africains reconnus par l'ONU.
const africanCountries: { name: string; iso2: string; iso3: string }[] = [
  { name: 'Algeria', iso2: 'DZ', iso3: 'DZA' },
  { name: 'Angola', iso2: 'AO', iso3: 'AGO' },
  { name: 'Benin', iso2: 'BJ', iso3: 'BEN' },
  { name: 'Botswana', iso2: 'BW', iso3: 'BWA' },
  { name: 'Burkina Faso', iso2: 'BF', iso3: 'BFA' },
  { name: 'Burundi', iso2: 'BI', iso3: 'BDI' },
  { name: 'Cabo Verde', iso2: 'CV', iso3: 'CPV' },
  { name: 'Cameroon', iso2: 'CM', iso3: 'CMR' },
  { name: 'Central African Republic', iso2: 'CF', iso3: 'CAF' },
  { name: 'Chad', iso2: 'TD', iso3: 'TCD' },
  { name: 'Comoros', iso2: 'KM', iso3: 'COM' },
  { name: 'Congo (Republic of the)', iso2: 'CG', iso3: 'COG' },
  { name: 'Congo (Democratic Republic of the)', iso2: 'CD', iso3: 'COD' },
  { name: "Cote d'Ivoire", iso2: 'CI', iso3: 'CIV' },
  { name: 'Djibouti', iso2: 'DJ', iso3: 'DJI' },
  { name: 'Egypt', iso2: 'EG', iso3: 'EGY' },
  { name: 'Equatorial Guinea', iso2: 'GQ', iso3: 'GNQ' },
  { name: 'Eritrea', iso2: 'ER', iso3: 'ERI' },
  { name: 'Eswatini', iso2: 'SZ', iso3: 'SWZ' },
  { name: 'Ethiopia', iso2: 'ET', iso3: 'ETH' },
  { name: 'Gabon', iso2: 'GA', iso3: 'GAB' },
  { name: 'Gambia', iso2: 'GM', iso3: 'GMB' },
  { name: 'Ghana', iso2: 'GH', iso3: 'GHA' },
  { name: 'Guinea', iso2: 'GN', iso3: 'GIN' },
  { name: 'Guinea-Bissau', iso2: 'GW', iso3: 'GNB' },
  { name: 'Kenya', iso2: 'KE', iso3: 'KEN' },
  { name: 'Lesotho', iso2: 'LS', iso3: 'LSO' },
  { name: 'Liberia', iso2: 'LR', iso3: 'LBR' },
  { name: 'Libya', iso2: 'LY', iso3: 'LBY' },
  { name: 'Madagascar', iso2: 'MG', iso3: 'MDG' },
  { name: 'Malawi', iso2: 'MW', iso3: 'MWI' },
  { name: 'Mali', iso2: 'ML', iso3: 'MLI' },
  { name: 'Mauritania', iso2: 'MR', iso3: 'MRT' },
  { name: 'Mauritius', iso2: 'MU', iso3: 'MUS' },
  { name: 'Morocco', iso2: 'MA', iso3: 'MAR' },
  { name: 'Mozambique', iso2: 'MZ', iso3: 'MOZ' },
  { name: 'Namibia', iso2: 'NA', iso3: 'NAM' },
  { name: 'Niger', iso2: 'NE', iso3: 'NER' },
  { name: 'Nigeria', iso2: 'NG', iso3: 'NGA' },
  { name: 'Rwanda', iso2: 'RW', iso3: 'RWA' },
  { name: 'Sao Tome and Principe', iso2: 'ST', iso3: 'STP' },
  { name: 'Senegal', iso2: 'SN', iso3: 'SEN' },
  { name: 'Seychelles', iso2: 'SC', iso3: 'SYC' },
  { name: 'Sierra Leone', iso2: 'SL', iso3: 'SLE' },
  { name: 'Somalia', iso2: 'SO', iso3: 'SOM' },
  { name: 'South Africa', iso2: 'ZA', iso3: 'ZAF' },
  { name: 'South Sudan', iso2: 'SS', iso3: 'SSD' },
  { name: 'Sudan', iso2: 'SD', iso3: 'SDN' },
  { name: 'Tanzania', iso2: 'TZ', iso3: 'TZA' },
  { name: 'Togo', iso2: 'TG', iso3: 'TGO' },
  { name: 'Tunisia', iso2: 'TN', iso3: 'TUN' },
  { name: 'Uganda', iso2: 'UG', iso3: 'UGA' },
  { name: 'Zambia', iso2: 'ZM', iso3: 'ZMB' },
  { name: 'Zimbabwe', iso2: 'ZW', iso3: 'ZWE' },
];

// Principaux marchés internationaux (clients/conférences hors Afrique).
// Hypothèse raisonnable en l'absence de liste imposée — à ajuster librement.
const internationalCountries: { name: string; iso2: string; iso3: string }[] =
  [
    { name: 'United States', iso2: 'US', iso3: 'USA' },
    { name: 'United Kingdom', iso2: 'GB', iso3: 'GBR' },
    { name: 'France', iso2: 'FR', iso3: 'FRA' },
    { name: 'Canada', iso2: 'CA', iso3: 'CAN' },
    { name: 'United Arab Emirates', iso2: 'AE', iso3: 'ARE' },
    { name: 'Saudi Arabia', iso2: 'SA', iso3: 'SAU' },
    { name: 'Qatar', iso2: 'QA', iso3: 'QAT' },
    { name: 'Germany', iso2: 'DE', iso3: 'DEU' },
    { name: 'Switzerland', iso2: 'CH', iso3: 'CHE' },
    { name: 'India', iso2: 'IN', iso3: 'IND' },
    { name: 'China', iso2: 'CN', iso3: 'CHN' },
  ];

async function main() {
  await Promise.all(
    pillars.map((pillar, index) =>
      prisma.pillar.upsert({
        where: { slug: pillar.slug },
        update: { name: pillar.name, displayOrder: index },
        create: { ...pillar, displayOrder: index },
      }),
    ),
  );

  await Promise.all(
    formats.map((format, index) =>
      prisma.format.upsert({
        where: { slug: format.slug },
        update: { name: format.name, displayOrder: index },
        create: { ...format, displayOrder: index },
      }),
    ),
  );

  await Promise.all(
    languages.map((language, index) =>
      prisma.language.upsert({
        where: { code: language.code },
        update: { name: language.name, displayOrder: index },
        create: { ...language, displayOrder: index },
      }),
    ),
  );

  const countries = [...africanCountries, ...internationalCountries];
  await Promise.all(
    countries.map((country, index) =>
      prisma.country.upsert({
        where: { iso2: country.iso2 },
        update: { name: country.name, iso3: country.iso3 },
        create: { ...country, displayOrder: index },
      }),
    ),
  );

  console.log(
    `[seed] OK : ${pillars.length} piliers, ${formats.length} formats, ${languages.length} langues, ${countries.length} pays.`,
  );

  await seedBootstrapAdmin();
}

// Il n'existe pas d'inscription publique (les comptes sont provisionnés par
// un admin) : sans ce compte de bootstrap, personne ne pourrait se connecter
// au tout premier démarrage. Idempotent (upsert) et sauté si les variables
// SEED_ADMIN_* sont absentes.
async function seedBootstrapAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      '[seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD absents : aucun compte admin de bootstrap créé.',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'Super',
      lastName: 'Admin',
      // Compte provisionné directement en base par l'équipe : on le
      // considère vérifié dès la création (pas de flux de vérification
      // par email à faire suivre pour ce cas de bootstrap unique).
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`[seed] OK : compte SUPER_ADMIN prêt (${email}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
