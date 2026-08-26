<script setup lang="ts">
// Paramètres > Utilisateurs (§A1). Les actions interdites par les
// garde-fous sont DÉSACTIVÉES ici avec une infobulle -- jamais seulement
// refusées par l'API après le clic (voir *DisabledReason() ci-dessous,
// reflet client des garde-fous de UsersService, même principe que
// speaker-status.ts/booking-status.ts : l'API reste seule source de
// vérité, une divergence n'affiche qu'une option en trop, jamais un
// contournement).
import { onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Paginator from 'primevue/paginator';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import StatusTag from '../../../components/StatusTag.vue';
import InviteUserDialog from '../components/InviteUserDialog.vue';
import DeactivateUserDialog from '../components/DeactivateUserDialog.vue';
import { useApiList } from '../../../composables/useApiList';
import { useAuthStore } from '../../../stores/auth';
import {
  fetchUsers,
  countActiveSuperAdmins,
  updateUser,
  type UserListItem,
} from '../../../services/users';
import { userStatusInfo, roleLabel, ROLE_LABELS } from '../../../config/user-status';

const auth = useAuthStore();
const confirm = useConfirm();
const toast = useToast();

const isSuperAdmin = () => auth.user?.role === 'SUPER_ADMIN';
const RESERVED_TOOLTIP = 'Réservé aux super administrateurs.';

const list = useApiList<UserListItem, Record<string, string | undefined>>({
  fetcher: (params) =>
    fetchUsers({
      page: params.page,
      perPage: params.perPage,
      search: params.search,
      role: params.role,
      status: params.status,
    }),
  defaultFilters: { search: '', role: '', status: '' },
  defaultPerPage: 25,
});

const activeSuperAdminCount = ref(0);
async function refreshSuperAdminCount(): Promise<void> {
  activeSuperAdminCount.value = await countActiveSuperAdmins();
}
onMounted(refreshSuperAdminCount);

async function refreshAll(): Promise<void> {
  await Promise.all([list.refresh(), refreshSuperAdminCount()]);
}

const roleOptions = [
  { value: 'ADMIN', label: ROLE_LABELS.ADMIN },
  { value: 'SUPER_ADMIN', label: ROLE_LABELS.SUPER_ADMIN },
];
const statusOptions = [
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'INVITED', label: 'Invité, en attente' },
  { value: 'SUSPENDED', label: 'Suspendu' },
  { value: 'DISABLED', label: 'Désactivé' },
];

function isLastActiveSuperAdmin(row: UserListItem): boolean {
  return (
    row.role === 'SUPER_ADMIN' &&
    row.status === 'ACTIVE' &&
    activeSuperAdminCount.value <= 1
  );
}

function roleChangeDisabledReason(row: UserListItem): string | null {
  if (!isSuperAdmin()) return RESERVED_TOOLTIP;
  if (row.id === auth.user?.id) return 'Vous ne pouvez pas modifier votre propre rôle.';
  if (isLastActiveSuperAdmin(row)) {
    return "C'est le dernier super administrateur actif -- impossible à rétrograder.";
  }
  return null;
}

function deactivateDisabledReason(row: UserListItem): string | null {
  if (!isSuperAdmin()) return RESERVED_TOOLTIP;
  if (row.status === 'DISABLED') return 'Déjà désactivé.';
  if (row.id === auth.user?.id) return 'Vous ne pouvez pas désactiver votre propre compte.';
  if (isLastActiveSuperAdmin(row)) {
    return "C'est le dernier super administrateur actif -- impossible à désactiver.";
  }
  return null;
}

function otherRole(role: string): 'ADMIN' | 'SUPER_ADMIN' {
  return role === 'SUPER_ADMIN' ? 'ADMIN' : 'SUPER_ADMIN';
}
function roleChangeLabel(row: UserListItem): string {
  return row.role === 'SUPER_ADMIN' ? 'Rétrograder en administrateur' : 'Promouvoir en super administrateur';
}

const changingRoleFor = ref<number | null>(null);
function confirmRoleChange(row: UserListItem): void {
  const target = otherRole(row.role);
  confirm.require({
    message: `Changer le rôle de ${row.firstName ?? row.email} en « ${ROLE_LABELS[target]} » ?`,
    header: 'Changer le rôle',
    icon: 'pi pi-user',
    acceptLabel: 'Confirmer',
    rejectLabel: 'Annuler',
    accept: () => void doRoleChange(row),
  });
}
async function doRoleChange(row: UserListItem): Promise<void> {
  changingRoleFor.value = row.id;
  try {
    await updateUser(row.id, { role: otherRole(row.role) });
    await refreshAll();
    toast.add({ severity: 'success', summary: 'Rôle mis à jour', life: 3000 });
  } finally {
    changingRoleFor.value = null;
  }
}

const deactivateDialogOpen = ref(false);
const deactivateTarget = ref<UserListItem | null>(null);
function openDeactivate(row: UserListItem): void {
  deactivateTarget.value = row;
  deactivateDialogOpen.value = true;
}

const inviteDialogOpen = ref(false);

function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}
</script>

<template>
  <div class="users-panel">
    <div class="users-panel__toolbar">
      <InputText
        :model-value="list.filters.search"
        placeholder="Rechercher un nom ou un e-mail…"
        class="users-panel__search"
        @update:model-value="(v) => list.setFilter('search', (v as string) ?? '')"
      />
      <Select
        :model-value="list.filters.role"
        :options="roleOptions"
        option-label="label"
        option-value="value"
        show-clear
        placeholder="Tous les rôles"
        @update:model-value="(v) => list.setFilter('role', v ?? '')"
      />
      <Select
        :model-value="list.filters.status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        show-clear
        placeholder="Tous les statuts"
        @update:model-value="(v) => list.setFilter('status', v ?? '')"
      />
      <span class="users-panel__spacer" />
      <Button
        v-tooltip.top="!isSuperAdmin() ? RESERVED_TOOLTIP : undefined"
        label="Inviter un utilisateur"
        icon="pi pi-user-plus"
        :disabled="!isSuperAdmin()"
        @click="inviteDialogOpen = true"
      />
    </div>

    <div v-if="list.error.value" class="state-block state-block--error">
      <Message severity="error" variant="simple" size="small">{{
        (list.error.value as Error)?.message ?? 'Erreur inconnue.'
      }}</Message>
      <Button label="Réessayer" size="small" @click="list.refresh()" />
    </div>

    <div v-else-if="list.loading.value" class="state-block">
      <div v-for="n in 5" :key="n" class="skeleton-row">
        <Skeleton height="0.85rem" width="8rem" />
        <Skeleton height="0.85rem" />
        <Skeleton width="5rem" height="0.85rem" />
      </div>
    </div>

    <div v-else-if="list.isEmpty.value" class="state-block">
      <span class="state-block__icon">＋</span>
      <div class="state-block__title">Aucun utilisateur trouvé</div>
    </div>

    <DataTable v-else :value="list.items.value" data-key="id" row-hover class="users-table">
      <Column header="Nom" style="min-width: 180px">
        <template #body="{ data }: { data: UserListItem }">
          {{ [data.firstName, data.lastName].filter(Boolean).join(' ') || '—' }}
        </template>
      </Column>
      <Column field="email" header="E-mail" style="min-width: 220px" />
      <Column header="Rôle" style="min-width: 160px">
        <template #body="{ data }: { data: UserListItem }">
          {{ roleLabel(data.role) }}
        </template>
      </Column>
      <Column header="Statut" style="min-width: 150px">
        <template #body="{ data }: { data: UserListItem }">
          <StatusTag :label="userStatusInfo(data.status).label" :family="userStatusInfo(data.status).family" />
        </template>
      </Column>
      <Column header="Dernière connexion" style="min-width: 160px">
        <template #body="{ data }: { data: UserListItem }">
          {{ formatDateTime(data.lastLoginAt) }}
        </template>
      </Column>
      <Column header="" style="min-width: 320px">
        <template #body="{ data }: { data: UserListItem }">
          <div class="row-actions">
            <Button
              v-tooltip.top="roleChangeDisabledReason(data) ?? undefined"
              :label="roleChangeLabel(data)"
              size="small"
              text
              :disabled="!!roleChangeDisabledReason(data)"
              :loading="changingRoleFor === data.id"
              @click="confirmRoleChange(data)"
            />
            <Button
              v-tooltip.top="deactivateDisabledReason(data) ?? undefined"
              label="Désactiver"
              size="small"
              text
              severity="danger"
              :disabled="!!deactivateDisabledReason(data)"
              @click="openDeactivate(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <Paginator
      v-if="!list.isEmpty.value && !list.loading.value"
      :rows="list.meta.value.perPage"
      :total-records="list.meta.value.total"
      :first="(list.page.value - 1) * list.meta.value.perPage"
      :rows-per-page-options="[25, 50, 100]"
      @page="(e) => { list.setPage(e.page + 1); list.perPage.value = e.rows; }"
    />

    <InviteUserDialog v-model:visible="inviteDialogOpen" @invited="refreshAll" />
    <DeactivateUserDialog
      v-if="deactivateTarget"
      v-model:visible="deactivateDialogOpen"
      :user="deactivateTarget"
      @deactivated="refreshAll"
    />
  </div>
</template>

<style scoped>
.users-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--asb-space-2);
  background: var(--asb-surface-card);
  border: 1px solid var(--asb-border);
  padding: var(--asb-space-2);
  margin-bottom: var(--asb-space-3);
}

.users-panel__search {
  min-width: 240px;
}

.users-panel__spacer {
  flex: 1;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: var(--asb-space-1);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--asb-space-2);
  padding: var(--asb-space-8);
  text-align: center;
}

.state-block--error {
  color: var(--asb-danger-600);
}

.state-block__icon {
  width: 44px;
  height: 44px;
  border: 1px solid var(--asb-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--asb-text-muted);
  font-size: 18px;
}

.state-block__title {
  font-size: var(--asb-text-base);
  font-weight: 600;
  color: var(--asb-text);
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: var(--asb-space-3);
  padding: var(--asb-space-2) var(--asb-space-4);
}
</style>
