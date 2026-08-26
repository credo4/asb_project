<script setup lang="ts">
// 3.7 Fil de discussion avec le speaker -- AJOUT SEUL, ordre chronologique,
// rôle de l'auteur visible.
import { ref } from 'vue';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import type { MissionDetail } from '../../../services/missions';
import { createMissionMessage } from '../../../services/mission-messages';

const props = defineProps<{
  missionId: number;
  messages: MissionDetail['messages'];
}>();
const emit = defineEmits<{ changed: [] }>();

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Admin',
  ADMIN: 'Admin',
  SPEAKER: 'Speaker',
};

const newMessage = ref('');
const sending = ref(false);
async function send(): Promise<void> {
  if (!newMessage.value.trim()) return;
  sending.value = true;
  try {
    await createMissionMessage(props.missionId, { body: newMessage.value });
    newMessage.value = '';
    emit('changed');
  } finally {
    sending.value = false;
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR');
}
</script>

<template>
  <section class="detail-card">
    <h2 class="detail-card__title">Messages</h2>

    <ul class="message-thread">
      <li v-for="m in messages" :key="m.id" class="message-item">
        <div class="message-item__meta">
          <span class="message-item__role" :class="`message-item__role--${m.authorRole.toLowerCase()}`">{{
            ROLE_LABELS[m.authorRole] ?? m.authorRole
          }}</span>
          <span>{{ m.authorEmail ?? '—' }}</span>
          <span>{{ formatDateTime(m.createdAt) }}</span>
        </div>
        <p class="message-item__body">{{ m.body }}</p>
      </li>
      <li v-if="messages.length === 0" class="detail-card__hint">Aucun message pour l'instant.</li>
    </ul>

    <div class="message-form">
      <Textarea v-model="newMessage" rows="2" auto-resize placeholder="Écrire au speaker…" class="w-full" />
      <Button label="Envoyer" size="small" :loading="sending" :disabled="!newMessage.trim()" @click="send" />
    </div>
  </section>
</template>

<style scoped>
.detail-card {
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-6);
}

.detail-card__title {
  margin: 0 0 var(--asb-space-4);
  font-size: var(--asb-text-lg);
  font-weight: 600;
  color: var(--asb-text);
}

.detail-card__hint {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text-muted);
  list-style: none;
}

.message-thread {
  list-style: none;
  margin: 0 0 var(--asb-space-4);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-3);
  max-height: 360px;
  overflow-y: auto;
}

.message-item {
  padding: var(--asb-space-2) var(--asb-space-3);
  border-left: 3px solid var(--asb-border-strong);
}

.message-item__meta {
  display: flex;
  align-items: center;
  gap: var(--asb-space-2);
  font-size: 12px;
  color: var(--asb-text-muted);
  margin-bottom: 2px;
}

.message-item__role {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--asb-radius-sm);
}

.message-item__role--admin,
.message-item__role--super_admin {
  background: var(--asb-gold-50);
  color: var(--asb-gold-700);
  border: 1px solid var(--asb-gold-300);
}

.message-item__role--speaker {
  background: var(--asb-info-50);
  color: var(--asb-info-600);
  border: 1px solid #c4d8e6;
}

.message-item__body {
  margin: 0;
  font-size: var(--asb-text-sm);
  color: var(--asb-text);
  white-space: pre-wrap;
}

.message-form {
  display: flex;
  flex-direction: column;
  gap: var(--asb-space-2);
  align-items: flex-end;
}

.w-full {
  width: 100%;
}
</style>
