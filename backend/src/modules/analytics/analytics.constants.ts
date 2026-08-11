// Types d'événements acceptés par l'écriture PUBLIQUE (POST
// /public/analytics/events) — allow-list STRICTE (§B3). PROFILE_VIEW et
// SEARCH sont déjà captés côté serveur (le back voit la requête qui les
// déclenche) : volontairement ABSENTS d'ici, un client ne doit jamais
// pouvoir forger ces deux-là depuis l'extérieur.
export const PUBLIC_ANALYTICS_EVENT_TYPES = [
  'CHECK_AVAILABILITY_CLICK',
  'CURATED_LIST_VIEW',
  'TOPIC_VIEW',
] as const;

export type PublicAnalyticsEventType =
  (typeof PUBLIC_ANALYTICS_EVENT_TYPES)[number];

// Détection de crawlers connus par user-agent — liste non exhaustive,
// suffisante pour un flag `isBot` INDICATIF (§B5) : on ne rejette jamais ces
// lignes, on les marque pour exclusion au moment de l'analyse (Phase 4).
export const BOT_USER_AGENT_PATTERNS: RegExp[] = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /googlebot/i,
  /bingbot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /headlesschrome/i, // souvent utilisé par des scrapers automatisés
];

export const MAX_USER_AGENT_LENGTH = 255;
export const MAX_REFERRER_LENGTH = 255;
