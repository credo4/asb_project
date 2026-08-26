// Preset PrimeVue ASB — couche 2 du thème (voir src/styles/tokens.css pour
// la couche 1). Copié VERBATIM depuis « Système de Design ASB.dc.html »
// (section 07 — Thème PrimeVue). Les composants ne référencent que les
// tokens --p-* générés par ce preset ; changer la marque ne touche QUE la
// couche 1 (tokens.css), jamais ce fichier.
//
// Concept TS : `definePreset` est une fonction générique fournie par
// PrimeVue qui prend un thème de base (Aura) et un objet de overrides, et
// retourne un nouveau thème typé — un pattern de composition plutôt que
// d'héritage de classe.
import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';

export const AsbPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: 'var(--asb-gold-50)',
      300: 'var(--asb-gold-300)',
      500: 'var(--asb-gold-500)',
      700: 'var(--asb-gold-700)',
    },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: 'var(--asb-gold-500)',
      offset: '2px',
    },
    formField: {
      paddingX: 'var(--asb-space-3)',
      borderRadius: 'var(--asb-radius-sm)',
      focusRing: { width: '2px', offset: '2px' },
    },
    colorScheme: {
      light: {
        surface: {
          0: 'var(--asb-surface-card)',
          50: 'var(--asb-surface-page)',
          100: 'var(--asb-surface-hover)',
          200: 'var(--asb-border)',
          300: 'var(--asb-border-strong)',
        },
        text: {
          color: 'var(--asb-text)',
          mutedColor: 'var(--asb-text-muted)',
        },
        primary: {
          color: 'var(--asb-gold-500)',
          contrastColor: 'var(--asb-ink-900)',
          hoverColor: 'var(--asb-gold-700)',
        },
        highlight: {
          background: 'var(--asb-surface-selected)',
          color: 'var(--asb-text)',
        },
      },
      dark: {
        surface: {
          0: 'var(--asb-dark-surface-1)',
          50: 'var(--asb-dark-surface-0)',
          100: 'var(--asb-dark-surface-2)',
          200: 'var(--asb-dark-surface-3)',
        },
        text: {
          color: 'var(--asb-dark-text)',
          mutedColor: 'var(--asb-dark-text-muted)',
        },
        primary: {
          color: 'var(--asb-gold-300)',
          contrastColor: 'var(--asb-ink-900)',
          hoverColor: 'var(--asb-gold-500)',
        },
      },
    },
  },
  components: {
    datatable: {
      headerCell: { background: 'var(--asb-surface-hover)' },
      bodyCell: { padding: 'var(--asb-space-3) var(--asb-space-4)' },
      row: { stripedBackground: 'transparent' },
    },
    button: { borderRadius: 'var(--asb-radius-sm)' },
    tag: { borderRadius: 'var(--asb-radius-sm)' },
  },
});
