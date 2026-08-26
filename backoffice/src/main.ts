import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';
import App from './App.vue';
import router from './router';
import { AsbPreset } from './theme/asb-preset';
import { primeVueLocaleFr } from './theme/primevue-locale-fr';
import { useAuthStore } from './stores/auth';
import './styles/tokens.css';
import './styles/base.css';
// Jamais importée jusqu'ici (paquet installé en Phase 1, feuille de style
// oubliée) : toutes les icônes `pi pi-*` de l'app étaient invisibles
// (classes présentes, aucune police d'icônes chargée) -- pas seulement
// dans la barre latérale, partout où <i class="pi pi-*"> ou l'attribut
// `icon` d'un <Button> PrimeVue est utilisé.
import 'primeicons/primeicons.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: AsbPreset,
    options: {
      // La classe .asb-dark sur <html> reste réservée à l'espace speaker
      // (voir prompt, règle n°3) : le mécanisme est câblé ici, mais jamais
      // activé dans le back-office (chrome sombre en dur, voir AppShell.vue,
      // pas de bascule de thème global).
      darkModeSelector: '.asb-dark',
    },
  },
  // Revue avant démo (point 4) : sans ceci, les libellés INTERNES de
  // PrimeVue (pagination, sélecteur de date, dépôt de fichier...)
  // retombent sur l'anglais par défaut, invisible en lecture de code.
  locale: primeVueLocaleFr,
});
app.use(ToastService);
app.use(ConfirmationService);
app.directive('tooltip', Tooltip);

// Revalide la session (token localStorage) AVANT de monter l'app : le garde
// de route (router/index.ts) a besoin de savoir si l'utilisateur est
// connecté dès la toute première navigation, pas après un aller-retour
// réseau qui arriverait trop tard pour la première résolution de route.
const auth = useAuthStore();
void auth.initialize().finally(() => {
  app.mount('#app');
});
