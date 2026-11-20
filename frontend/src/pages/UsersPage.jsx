import { useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { usersApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDebounce } from '../hooks/useDebounce.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'CONSULTA', active: true };
const ROLES = [
  { value: 'ADMINISTRADOR', label: 'Administrador' },
  { value: 'ENCARGADO_INVENTARIO', label: 'Encargado de inventario' },
  { value: 'CONSULTA', label: 'Solo consulta' },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { success, error: notifyError } = useToast();
  const [filters, setFilters] = useState({ q: '', role: '', active: '', page: 1, limit: 10 });
  const debounced = useDebounce(filters.q, 350);
  const query = useMemo(() => ({
    ...filters,
    q: debounced || undefined,
    role: filters.role || undefined,
    active: filters.active || undefined,
  }), [filters, debounced]);
  const { data, loading, reload } = useApi(() => usersApi.list(query), [query]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name, email: row.email, password: '', role: row.role, active: row.active });
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, { name: form.name, email: form.email, role: form.role, active: form.active });
        success('Usuario actualizado');
      } else {
        await usersApi.create(form);
        success('Usuario creado');
      }
      setOpen(false);
      reload();
    } catch (err) { notifyError(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const execute = async () => {
    try {
      if (confirm.action === 'toggle') await usersApi.setActive(confirm.row.id, !confirm.row.active);
      else await usersApi.resetPassword(confirm.row.id, confirm.password);
      success(confirm.action === 'toggle' ? 'Estado del usuario actualizado' : 'Contraseña restablecida');
      setConfirm(null);
      setPassword('');
      reload();
    } catch (err) { notifyError(errorMessage(err)); }
  };

  const columns = [
    {
      key: 'name', label: 'Usuario',
      render: (row) => <><strong>{row.name}</strong><small className="cell-sub">{row.email}</small></>,
    },
    { key: 'role', label: 'Rol', render: (row) => <Badge tone={row.role === 'ADMINISTRADOR' ? 'danger' : row.role === 'ENCARGADO_INVENTARIO' ? 'info' : 'neutral'}>{row.roleLabel}</Badge> },
    { key: 'active', label: 'Estado', render: (row) => <StatusPill value={row.active ? 'active' : 'inactive'} /> },
    {
      key: 'actions', label: 'Acciones', align: 'right',
      render: (row) => (
        <div className="row-actions">
          <button type="button" title="Editar" onClick={() => openEdit(row)}><Pencil size={16} /></button>
          <button type="button" title="Restablecer contraseña" onClick={() => setPasswordOpen(row)}><KeyRound size={16} /></button>
          <button
            type="button"
            title={row.active ? 'Desactivar' : 'Activar'}
            disabled={row.id === currentUser?.id}
            onClick={() => setConfirm({ action: 'toggle', row })}
          >
            {row.active ? <UserX size={16} /> : <UserCheck size={16} />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Usuarios y permisos"
        description="Administre cuentas, roles y estados de acceso al sistema."
        actions={<Button icon={Plus} onClick={openCreate}>Nuevo usuario</Button>}
      />

      <Card>
        <CardBody>
          <div className="filters-bar">
            <div className="search-box"><Search size={17} />
              <Input placeholder="Buscar por nombre o correo…" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })} />
            </div>
            <Select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value, page: 1 })}>
              <option value="">Todos los roles</option>
              {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </Select>
            <Select value={filters.active} onChange={(event) => setFilters({ ...filters, active: event.target.value, page: 1 })}>
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </div>
          <Table columns={columns} rows={data?.data} loading={loading} emptyMessage="No se encontraron usuarios" />
          <Pagination meta={data?.meta} onChange={(page) => setFilters({ ...filters, page })} />
        </CardBody>
      </Card>

      <div className="roles-legend">
        <strong>Roles del sistema</strong>
        <div>
          <span><Badge tone="danger">Administrador</Badge> Acceso total a módulos, usuarios y configuración.</span>
          <span><Badge tone="info">Encargado de inventario</Badge> Registra productos, categorías, proveedores y movimientos.</span>
          <span><Badge tone="neutral">Solo consulta</Badge> Puede ver información, alertas, indicadores y reportes.</span>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar usuario' : 'Nuevo usuario'} size="md"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="user-form" loading={saving}>Guardar</Button></>}>
        <form id="user-form" onSubmit={submit} className="form-stack">
          <Field label="Nombre completo"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Correo electrónico"><Input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          {!editing && <Field label="Contraseña temporal" hint="Mínimo 8 caracteres">
            <Input type="password" minLength={8} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </Field>}
          <Field label="Rol">
            <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </Select>
          </Field>
          <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Cuenta activa</label>
        </form>
      </Modal>

      <Modal open={Boolean(passwordOpen)} onClose={() => setPasswordOpen(null)} title="Restablecer contraseña" subtitle={passwordOpen?.name} size="sm"
        footer={<><Button variant="ghost" onClick={() => setPasswordOpen(null)}>Cancelar</Button>
          <Button onClick={() => { setConfirm({ action: 'password', row: passwordOpen, password }); setPasswordOpen(null); }} disabled={password.length < 8}>Restablecer</Button></>}>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
          <Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={execute}
        title={confirm?.action === 'password' ? 'Confirmar restablecimiento' : 'Cambiar estado del usuario'}
        message={confirm?.action === 'password'
          ? `¿Asignar una nueva contraseña a ${confirm?.row?.name}?`
          : `¿${confirm?.row?.active ? 'Desactivar' : 'Activar'} la cuenta de ${confirm?.row?.name}?`}
        confirmLabel={confirm?.action === 'password' ? 'Restablecer' : 'Confirmar'}
      />
    </>
  );
}
