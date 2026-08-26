import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

// Concept TS : "module augmentation" — on étend l'interface `RouteMeta`
// (déclarée vide par vue-router) avec nos propres champs. Chaque route
// bénéficie alors de la complétion/vérification de type sur `meta.public`
// et `meta.roles`, au lieu d'un `meta: Record<string, any>` non typé.
declare module 'vue-router' {
  interface RouteMeta {
    /** Accessible sans connexion (écrans d'auth, /_design). */
    public?: boolean;
    /** Rôles autorisés ; absent = tous les rôles connectés. */
    roles?: Array<'SUPER_ADMIN' | 'ADMIN'>;
  }
}

// Page de référence visuelle interne (voir prompt §1.2), jamais liée depuis
// le menu. Route enregistrée UNIQUEMENT en dev (revue avant démo, point 7) :
// `import.meta.env.DEV` est une constante connue à la compilation (Vite),
// ce bloc — y compris l'import() dynamique du chunk — est donc entièrement
// éliminé du build de production, pas juste rendue inaccessible côté
// runtime ; /_design en prod retombe sur le 404 générique, comme n'importe
// quelle route inexistante.
const designSystemRoute: RouteRecordRaw[] = import.meta.env.DEV
  ? [
      {
        path: '/_design',
        name: 'design-system',
        component: () => import('../views/DesignSystemView.vue'),
        meta: { public: true },
      },
    ]
  : [];

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/auth/ForgotPasswordView.vue'),
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/auth/ResetPasswordView.vue'),
      meta: { public: true },
    },
    ...designSystemRoute,
    {
      path: '/',
      component: () => import('../layouts/AppShell.vue'),
      // Coquille applicative (menu latéral + en-tête, voir prompt §1.5) :
      // toute route protégée future (speakers, demandes, missions...)
      // s'ajoute ici en enfant et hérite du chrome sans rien dupliquer.
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('../views/DashboardView.vue'),
        },
        {
          path: 'speakers',
          name: 'speakers-list',
          component: () => import('../views/speakers/SpeakersListView.vue'),
        },
        {
          path: 'speakers/new',
          name: 'speakers-new',
          component: () => import('../views/speakers/SpeakerFormView.vue'),
        },
        {
          path: 'speakers/:id(\\d+)',
          name: 'speakers-detail',
          component: () => import('../views/speakers/SpeakerDetailView.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'speakers/:id(\\d+)/edit',
          name: 'speakers-edit',
          component: () => import('../views/speakers/SpeakerFormView.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'revisions',
          name: 'revisions-queue',
          component: () => import('../views/revisions/RevisionsQueueView.vue'),
        },
        {
          path: 'revisions/:id(\\d+)',
          name: 'revision-detail',
          component: () => import('../views/revisions/RevisionDetailView.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'booking-requests',
          name: 'booking-requests-inbox',
          component: () =>
            import('../views/booking-requests/BookingRequestsInboxView.vue'),
        },
        {
          path: 'booking-requests/:id(\\d+)',
          name: 'booking-request-detail',
          component: () =>
            import('../views/booking-requests/BookingRequestDetailView.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'roster-applications',
          name: 'roster-applications-list',
          component: () =>
            import('../views/roster-applications/RosterApplicationsListView.vue'),
        },
        {
          path: 'roster-applications/:id(\\d+)',
          name: 'roster-application-detail',
          component: () =>
            import('../views/roster-applications/RosterApplicationDetailView.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'missions',
          name: 'missions-list',
          component: () => import('../views/missions/MissionsListView.vue'),
        },
        {
          path: 'missions/:id(\\d+)',
          name: 'mission-detail',
          component: () => import('../views/missions/MissionDetailView.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'clients',
          name: 'clients-list',
          component: () => import('../views/clients/OrganizationsListView.vue'),
        },
        {
          path: 'clients/contacts/:id(\\d+)',
          name: 'contact-detail',
          component: () => import('../views/clients/ContactDetailView.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'clients/:id(\\d+)',
          name: 'organization-detail',
          component: () => import('../views/clients/OrganizationDetailView.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('../views/reports/ReportsView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/settings/SettingsView.vue'),
        },
      ],
    },
    {
      path: '/403',
      name: 'forbidden',
      component: () => import('../views/ForbiddenView.vue'),
      meta: { public: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: { public: true },
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    // Déjà connecté et on tente d'aller sur un écran d'auth : direction le
    // tableau de bord plutôt que de re-montrer le formulaire de connexion.
    if (
      (to.name === 'login' ||
        to.name === 'forgot-password' ||
        to.name === 'reset-password') &&
      auth.isAuthenticated
    ) {
      return { name: 'dashboard' };
    }
    return true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' };
  }

  // Ce back-office ne concerne QUE ADMIN/SUPER_ADMIN (voir README) — un
  // compte SPEAKER qui obtiendrait un token valide (rien ne l'empêche côté
  // /auth/login, qui accepte tous les rôles) n'a rien à y faire, quelle que
  // soit la route visée.
  const allowedRoles = to.meta.roles ?? (['SUPER_ADMIN', 'ADMIN'] as const);
  if (auth.user && !allowedRoles.includes(auth.user.role as 'SUPER_ADMIN' | 'ADMIN')) {
    return { name: 'forbidden' };
  }

  return true;
});

export default router;
