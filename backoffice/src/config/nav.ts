// Arborescence du menu latéral (voir prompt §1.5). Les entrées dont
// `to` est `null` n'ont pas encore d'écran (phases suivantes) : visibles
// mais désactivées, avec la mention "bientôt" — montrer la structure
// complète plutôt que cacher ce qui n'existe pas encore.
export interface NavItem {
  label: string;
  icon: string; // classe PrimeIcons, ex: "pi pi-home"
  to: string | null;
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  { label: 'Tableau de bord', icon: 'pi pi-home', to: '/' },
  {
    // "Speakers" est un simple en-tête pliable (pas un lien lui-même,
    // `to: null`) -- reference visuelle fournie par l'utilisateur (groupe
    // qui se deplie/replie, l'entete ne navigue nulle part). "Tous" est
    // donc une sous-entree comme les autres, pas redondante. "Demandes
    // clients" (booking_requests) reste hors de ce groupe : ce sont des
    // clients qui sollicitent un speaker, pas des speakers, un objet
    // metier distinct -- entree de premier niveau separee juste en dessous.
    label: 'Speakers',
    icon: 'pi pi-users',
    to: null,
    children: [
      { label: 'Tous', icon: 'pi pi-circle', to: '/speakers' },
      { label: 'Profils à valider', icon: 'pi pi-circle', to: '/revisions' },
      { label: 'Candidatures', icon: 'pi pi-circle', to: '/roster-applications' },
    ],
  },
  { label: 'Demandes clients', icon: 'pi pi-inbox', to: '/booking-requests' },
  { label: 'Missions', icon: 'pi pi-briefcase', to: '/missions' },
  { label: 'Clients', icon: 'pi pi-building', to: '/clients' },
  { label: 'Contenus', icon: 'pi pi-file-edit', to: null },
  { label: 'Rapports', icon: 'pi pi-chart-bar', to: '/reports' },
  { label: 'Paramètres', icon: 'pi pi-cog', to: '/settings' },
];
