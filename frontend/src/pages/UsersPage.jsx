import { useMemo, useState } from 'react';
import { Building2, KeyRound, Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { usersApi, superadminApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDebounce } from '../hooks/useDebounce.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';

const EMPTY = {
  name: '', email: '', password: '', role: 'CONSULTA', establishmentId: '', active: true,
};
const ROLES = [
  { value: 'ADMINISTRADOR', label: 'Administrador' },
  { value: 'ENCARGADO_INVENTARIO', label: 'Encargado de inventario' },
  { value: 'CONSULTA', label: 'Solo consulta' },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { success, error: notifyError } = useToast();
  const [filters, setFilters] = useState({
    q: '', role: '', active: '', establishmentId: '', page: 1, limit: 10,
  });
  const [grouped, setGrouped] = useState(true);
  const debounced = useDebounce(filters.q, 350);
  const commonFilters = useMemo(() => ({
    q: debounced || undefined,
    role: filters.role || undefined,
    active: filters.active || undefined,
  }), [debounced, filters.role, filters.active]);
  const query = useMemo(() => ({
    ...commonFilters,
    establishmentId: filters.establishmentId || undefined,
    page: filters.page,
    limit: filters.limit,
  }), [commonFilters, filters.establishmentId, filters.page, filters.limit]);
  const groupedQuery = useMemo(() => ({ ...commonFilters, page: 1, limit: 100 }), [commonFilters]);

  const { data, loading, reload } = useApi(() => usersApi.list(query), [query]);
  const {
    data: groupedData, loading: groupedLoading, reload: reloadGrouped,
  } = useApi(() => usersApi.list(groupedQuery), [groupedQuery]);
  // Opciones independientes de los filtros: el formulario siempre debe poder
  // elegir un establecimiento, aunque la lista esté filtrada o paginada.
  const establishmentChoices = useApi(
    () => superadminApi.establishments({ page: 1, limit: 100 }),
    [],
  );
  const establishmentOptions = establishmentChoices.data?.data || [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');

  const refresh = () => { reload(); reloadGrouped(); };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, establishmentId: filters.establishmentId || '' });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name,
      email: row.email,
      password: '',
      role: row.role,
      establishmentId: row.establishmentId ? String(row.establishmentId) : '',
      active: row.active,
    });
    setErrors({});
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (editing?.role === 'SUPERADMINISTRADOR') {
      notifyError('La cuenta superadministrador no puede modificarse desde el panel');
      return;
    }
    if (!form.establishmentId) {
      setErrors({ establishmentId: 'Seleccione un establecimiento' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        active: form.active,
        establishmentId: Number(form.establishmentId),
      };
      if (editing) {
        await usersApi.update(editing.id, payload);
        success('Usuario actualizado');
      } else {
        await usersApi.create({ ...payload, password: form.password });
        success('Usuario creado');
      }
      setOpen(false);
      refresh();
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
      refresh();
    } catch (err) { notifyError(errorMessage(err)); }
  };

  const columns = [
    {
      key: 'name', label: 'Usuario',
      render: (row) => <><strong>{row.name}</strong><small className="cell-sub">{row.email}</small></>,
    },
    { key: 'role', label: 'Rol', render: (row) => <Badge tone={row.role === 'ADMINISTRADOR' ? 'danger' : row.role === 'ENCARGADO_INVENTARIO' ? 'info' : 'neutral'}>{row.roleLabel || row.role}</Badge> },
    ...(grouped ? [] : [{
      key: 'establishmentName', label: 'Establecimiento',
      render: (row) => row.establishmentName
        || <span className="cell-sub">{row.role === 'SUPERADMINISTRADOR' ? 'Sin establecimiento' : 'Sin asignar'}</span>,
    }]),
    { key: 'active', label: 'Estado', render: (row) => <StatusPill value={row.active ? 'active' : 'inactive'} /> },
    {
      key: 'actions', label: 'Acciones', align: 'right',
      render: (row) => (row.role === 'SUPERADMINISTRADOR'
        ? <span className="cell-sub">No editable</span>
        : (
          <div className="row-actions row-actions--icons">
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
        )),
    },
  ];

  const groups = useMemo(() => {
    const byId = new Map();
    for (const row of groupedData?.data || []) {
      const key = row.establishmentId ?? 'none';
      if (!byId.has(key)) {
        byId.set(key, {
          key,
          name: row.establishmentName
            || (row.role === 'SUPERADMINISTRADOR'
              ? 'Sin establecimiento (superadministrador)'
              : 'Sin establecimiento'),
          users: [],
        });
      }
      byId.get(key).users.push(row);
    }
    return [...byId.values()];
  }, [groupedData]);

  return (
    <>
      <PageHeader
        title="Usuarios y permisos"
        description="Cada cuenta pertenece a un establecimiento y solo ve el inventario de ese comercio."
        actions={<Button icon={Plus} onClick={openCreate}>Nuevo usuario</Button>}
      />

      {grouped ? (
        <>
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

          <div className="user-groups">
            {groups.map((group) => (
              <Card key={group.key}>
                <CardHeader
                  title={<><Building2 size={18} /> {group.name}</>}
                  subtitle={`${group.users.length} ${group.users.length === 1 ? 'usuario' : 'usuarios'}`}
                  action={<Badge tone={group.key === 'none' ? 'neutral' : 'info'}>{group.key === 'none' ? 'Sin establecimiento' : `#${group.key}`}</Badge>}
                />
                <CardBody>
                  <Table columns={columns} rows={group.users} loading={groupedLoading} emptyMessage="Sin usuarios" />
                </CardBody>
              </Card>
            ))}
            {!groupedLoading && groups.length === 0 && (
              <Card><CardBody><p className="muted">No se encontraron usuarios con los filtros actuales.</p></CardBody></Card>
            )}
          </div>
          <p className="cell-sub">La vista agrupada muestra hasta 100 usuarios. Desactívala para paginar el listado completo.</p>
        </>
      ) : (
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
              <Select value={filters.establishmentId} onChange={(event) => setFilters({ ...filters, establishmentId: event.target.value, page: 1 })}>
                <option value="">Todos los establecimientos</option>
                {establishmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </div>
            <Table columns={columns} rows={data?.data} loading={loading} emptyMessage="No se encontraron usuarios" />
            <Pagination meta={data?.meta} onChange={(page) => setFilters({ ...filters, page })} />
          </CardBody>
        </Card>
      )}

      <label className="checkbox-field view-toggle">
        <input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} />
        Agrupar usuarios por establecimiento
      </label>

      <div className="roles-legend">
        <strong>Roles del sistema</strong>
        <div>
          <span><Badge tone="danger">Administrador</Badge> Gestiona inventario, alertas y reportes de su establecimiento.</span>
          <span><Badge tone="info">Encargado de inventario</Badge> Registra productos, categorías, proveedores y movimientos.</span>
          <span><Badge tone="neutral">Solo consulta</Badge> Puede ver información, alertas, indicadores y reportes.</span>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        subtitle="La cuenta queda asociada al establecimiento que seleccione."
        size="md"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="user-form" loading={saving}>Guardar</Button></>}>
        <form id="user-form" onSubmit={submit} className="form-stack">
          <div className="form-row">
            <Field label="Nombre completo"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Correo electrónico"><Input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          </div>
          {!editing && <Field label="Contraseña temporal" hint="Mínimo 8 caracteres">
            <Input type="password" minLength={8} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </Field>}
          <div className="form-row">
            <Field label="Rol">
              <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </Select>
            </Field>
            <Field label="Establecimiento" error={errors.establishmentId} hint="Determina qué inventario podrá ver el usuario.">
              <Select value={form.establishmentId} onChange={(event) => setForm({ ...form, establishmentId: event.target.value })} required>
                <option value="">Seleccione...</option>
                {establishmentOptions.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={!item.active && String(item.id) !== form.establishmentId}
                  >
                    {item.name}{item.active ? '' : ' (inactivo)'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
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
