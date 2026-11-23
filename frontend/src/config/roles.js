import { ROLE_LABELS } from './permissions.js';

/** Roles que el superadministrador puede asignar desde el panel. */
export const MANAGEABLE_ROLES = [
  { value: 'ADMINISTRADOR', label: ROLE_LABELS.ADMINISTRADOR },
  { value: 'ENCARGADO_INVENTARIO', label: ROLE_LABELS.ENCARGADO_INVENTARIO },
  { value: 'CONSULTA', label: ROLE_LABELS.CONSULTA },
];

export const isSuperAdminRow = (row) => row?.role === 'SUPERADMINISTRADOR';

export function roleTone(role) {
  if (role === 'SUPERADMINISTRADOR') return 'danger';
  if (role === 'ADMINISTRADOR') return 'info';
  return 'neutral';
}
