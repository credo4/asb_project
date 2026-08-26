// `primevue/toasteventbus` n'expose pas de .d.ts (voir lib/http.ts, qui
// l'utilise pour notifier hors composant, en dehors de tout `useToast()`).
// Forme minimale reprise de `EventBus()` (@primeuix/utils/eventbus), la
// seule utilisée ici : `emit('add', message)`.
declare module 'primevue/toasteventbus' {
  interface ToastEventBus {
    emit(event: string, payload?: unknown): void;
    on(event: string, callback: (payload?: unknown) => void): void;
    off(event: string, callback: (payload?: unknown) => void): void;
  }
  const ToastEventBus: ToastEventBus;
  export default ToastEventBus;
}
