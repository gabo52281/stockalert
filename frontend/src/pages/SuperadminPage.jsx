import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, KeyRound, Plus, Search, ShieldCheck, UserCog, Users,
} from 'lucide-react';
import { superadminApi, usersApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatDate } from '../utils/format.js';
import { ROLE_LABELS } from '../config/permissions.js';
import { MANAGEABLE_ROLES, isSuperAdminRow, roleTone } from '../config/roles.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';

const TABS = [
  ['resumen', 'Resumen'],
  ['establecimientos', 'Establecimientos'],
  ['usuarios', 'Usuarios y permisos'],
];

const EMPTY_ESTABLISHMENT = {
  name: '', taxId: '', address: '', phone: '', email: '', active: true,
};
const EMPTY_ADMIN = { name: '', email: '', password: '' };
const EMPTY_USER = {
  name: '', email: '', password: '', role: 'ENCARGADO_INVENTARIO',
  establishmentId: '', active: true,
};

function Stat({ icon: Icon, label, value, tone = 'blue' }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon"><Icon size={19} /></div>
      <div>
        <span>{label}</span>
        <strong>{value ?? '—'}</strong>
      </div>
    </div>
  );
}

function RolesLegend() {
  return (
    <div className="roles-legend">
      <strong>Roles del sistema</strong>
      <div>
        <span><Badge tone="info">{ROLE_LABELS.ADMINISTRADOR}</Badge> Gestiona inventario, alertas y reportes de su establecimiento.</span>
        <span><Badge tone="neutral">{ROLE_LABELS.ENCARGADO_INVENTARIO}</Badge> Registra productos, categorías, proveedores y movimientos.</span>
        <span><Badge tone="neutral">{ROLE_LABELS.CONSULTA}</Badge> Solo lectura de información, alertas, indicadores y reportes.</span>
        <span><Badge tone="danger">{ROLE_LABELS.SUPERADMINISTRADOR}</Badge> Administra comercios y cuentas; no consulta inventario ni IA.</span>
      </div>
    </div>
  );
}

export default function SuperadminPage() {
  const { user: currentUser } = useAuth();
  const { success, error: notifyError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.find(([value]) => value === searchParams.get('tab'))?.[0] || 'resumen';

  // Filtros independientes por pestaña: buscar un comercio no debe filtrar usuarios.
  const [estQ, setEstQ] = useState('');
  const [estPage, setEstPage] = useState(1);
  const [usrQ, setUsrQ] = useState('');
  const [usrRole, setUsrRole] = useState('');
  const [usrActive, setUsrActive] = useState('');
  const [usrEstablishment, setUsrEstablishment] = useState('');
  const [usrPage, setUsrPage] = useState(1);
  const [grouped, setGrouped] = useState(true);
  const debouncedEstQ = useDebounce(estQ, 350);
  const debouncedUsrQ = useDebounce(usrQ, 350);

  const [establishmentModal, setEstablishmentModal] = useState(false);
  const [withAdminModal, setWithAdminModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [usersModal, setUsersModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formEstablishment, setFormEstablishment] = useState(EMPTY_ESTABLISHMENT);
  const [formAdmin, setFormAdmin] = useState(EMPTY_ADMIN);
  const [formUser, setFormUser] = useState(EMPTY_USER);
  const [formPassword, setFormPassword] = useState({ id: null, password: '', confirm: '' });
  const [errors, setErrors] = useState({});

  const stats = useApi(() => superadminApi.stats(), []);
  const establishments = useApi(
    () => superadminApi.establishments({ page: estPage, limit: 10, q: debouncedEstQ }),
    [estPage, debouncedEstQ],
  );
  // Opciones independientes de la búsqueda y la paginación de las tablas.
  const establishmentChoices = useApi(
    () => superadminApi.establishments({ page: 1, limit: 100 }),
    [],
  );
  const usersCommon = useMemo(() => ({
    q: debouncedUsrQ || undefined,
    role: usrRole || undefined,
    active: usrActive || undefined,
  }), [debouncedUsrQ, usrRole, usrActive]);
  const usersQuery = useMemo(() => ({
    ...usersCommon,
    establishmentId: usrEstablishment || undefined,
    page: usrPage,
    limit: 10,
  }), [usersCommon, usrEstablishment, usrPage]);
  const groupedQuery = useMemo(() => ({ ...usersCommon, page: 1, limit: 100 }), [usersCommon]);
  const users = useApi(() => usersApi.list(usersQuery), [usersQuery]);
  const groupedUsers = useApi(() => usersApi.list(groupedQuery), [groupedQuery]);

  const establishmentOptions = establishmentChoices.data?.data || [];
  const userRows = users.data?.data || [];
  const establishmentRows = establishments.data?.data || [];

  const groups = useMemo(() => {
    const byId = new Map();
    for (const row of groupedUsers.data?.data || []) {
      const key = row.establishmentId ?? 'none';
      if (!byId.has(key)) {
        byId.set(key, {
          key,
          name: row.establishmentName
            || (isSuperAdminRow(row) ? 'Sin establecimiento (superadministrador)' : 'Sin establecimiento'),
          users: [],
        });
      }
      byId.get(key).users.push(row);
    }
    return [...byId.values()];
  }, [groupedUsers.data]);

  const userReloaders = [users.reload, groupedUsers.reload, stats.reload];

  const establishmentColumns = [
    { key: 'id', label: 'ID', render: (row) => <span className="mono">#{row.id}</span> },
    { key: 'name', label: 'Establecimiento', render: (row) => <><strong>{row.name}</strong><span className="cell-sub">{row.email || 'Sin correo de contacto'}</span></> },
    { key: 'tax_id', label: 'NIT', render: (row) => row.tax_id || '—' },
    { key: 'users_count', label: 'Usuarios', align: 'right', render: (row) => row.users_count ?? 0 },
    { key: 'created_at', label: 'Creado', render: (row) => formatDate(row.created_at) },
    {
      key: 'active', label: 'Estado',
      render: (row) => <Badge tone={row.active ? 'info' : 'danger'}>{row.active ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions', label: 'Acciones', align: 'right',
      render: (row) => (
        <div className="row-actions">
          <Button size="sm" variant="ghost" onClick={() => openEstablishment(row)}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={() => openEstablishmentUsers(row)}>Ver usuarios</Button>
          <Button
            size="sm"
            variant={row.active ? 'warning' : 'secondary'}
            onClick={() => setConfirm({
              title: row.active ? '¿Desactivar establecimiento?' : '¿Activar establecimiento?',
              message: `${row.name} ${row.active ? 'dejará de estar disponible' : 'volverá a estar disponible'}.`,
              confirmLabel: row.active ? 'Desactivar' : 'Activar',
              danger: row.active,
              action: () => mutate(
                () => superadminApi.setEstablishmentActive(row.id, !row.active),
                'Estado del establecimiento actualizado',
                [establishments.reload, stats.reload, groupedUsers.reload],
              ),
            })}
          >
            {row.active ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
  ];

  const userColumns = [
    { key: 'id', label: 'ID', render: (row) => <span className="mono">#{row.id}</span> },
    { key: 'name', label: 'Usuario', render: (row) => <><strong>{row.name}</strong><span className="cell-sub">{row.email}</span></> },
    {
      key: 'role', label: 'Rol',
      render: (row) => <Badge tone={roleTone(row.role)}>{row.roleLabel || row.role}</Badge>,
    },
    {
      key: 'establishmentName', label: 'Establecimiento',
      render: (row) => (row.establishmentName
        || <span className="cell-sub">{isSuperAdminRow(row) ? 'Sin establecimiento' : 'Sin asignar'}</span>),
    },
    {
      key: 'active', label: 'Estado',
      render: (row) => <Badge tone={row.active ? 'info' : 'danger'}>{row.active ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions', label: 'Acciones', align: 'right',
      render: (row) => (isSuperAdminRow(row)
        ? <span className="cell-sub">No editable</span>
        : (
          <div className="row-actions">
            <Button size="sm" variant="ghost" onClick={() => openUser(row)}>Editar</Button>
            <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => openPassword(row)}>Contraseña</Button>
            <Button
              size="sm"
              variant={row.active ? 'warning' : 'secondary'}
              disabled={row.id === currentUser?.id}
              onClick={() => setConfirm({
                title: row.active ? '¿Desactivar usuario?' : '¿Activar usuario?',
                message: `${row.name} ${row.active ? 'no podrá iniciar sesión' : 'podrá iniciar sesión nuevamente'}.`,
                confirmLabel: row.active ? 'Desactivar' : 'Activar',
                danger: row.active,
                action: () => mutate(
                  () => usersApi.setActive(row.id, !row.active),
                  'Estado del usuario actualizado',
                  userReloaders,
                ),
              })}
            >
              {row.active ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        )),
    },
  ].filter((column) => !(grouped && column.key === 'establishmentName'));

  function changeTab(value) {
    setSearchParams(value === 'resumen' ? {} : { tab: value }, { replace: true });
  }

  async function mutate(request, message, reloaders = []) {
    setSaving(true);
    try {
      await request();
      success(message);
      await Promise.all(reloaders.map((reload) => reload()));
      setConfirm(null);
      setEstablishmentModal(false);
      setWithAdminModal(false);
      setUserModal(false);
      setPasswordModal(false);
      setErrors({});
      return true;
    } catch (error) {
      notifyError(errorMessage(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openEstablishment(row) {
    setFormEstablishment({
      id: row?.id,
      name: row?.name || '',
      taxId: row?.tax_id || '',
      address: row?.address || '',
      phone: row?.phone || '',
      email: row?.email || '',
      active: row?.active ?? true,
    });
    setErrors({});
    setEstablishmentModal(true);
  }

  async function openEstablishmentUsers(row) {
    try {
      const response = await superadminApi.establishmentUsers(row.id);
      setUsersModal({ establishment: row, rows: response.data });
    } catch (error) {
      notifyError(errorMessage(error));
    }
  }

  function openUser(row) {
    if (isSuperAdminRow(row)) {
      notifyError('La cuenta superadministrador no puede modificarse desde el panel');
      return;
    }
    setFormUser({
      id: row?.id,
      name: row?.name || '',
      email: row?.email || '',
      password: '',
      role: row?.role || 'ENCARGADO_INVENTARIO',
      establishmentId: row?.establishmentId
        ? String(row.establishmentId)
        : (usrEstablishment ? String(usrEstablishment) : ''),
      active: row?.active ?? true,
    });
    setErrors({});
    setUserModal(true);
  }

  function openPassword(row) {
    if (isSuperAdminRow(row)) {
      notifyError('La contraseña del superadministrador no puede restablecerse desde el panel');
      return;
    }
    setFormPassword({ id: row.id, password: '', confirm: '' });
    setErrors({});
    setPasswordModal(true);
  }

  function establishmentPayload() {
    return {
      name: formEstablishment.name,
      taxId: formEstablishment.taxId || null,
      address: formEstablishment.address || null,
      phone: formEstablishment.phone || null,
      email: formEstablishment.email || null,
      active: formEstablishment.active,
    };
  }

  async function submitEstablishment(event) {
    event.preventDefault();
    const payload = establishmentPayload();
    if (formEstablishment.id) {
      await mutate(
        () => superadminApi.updateEstablishment(formEstablishment.id, payload),
        'Establecimiento actualizado',
        [establishments.reload, stats.reload, establishmentChoices.reload],
      );
    } else {
      await mutate(
        () => superadminApi.createEstablishment(payload),
        'Establecimiento creado con configuración inicial',
        [establishments.reload, stats.reload, establishmentChoices.reload],
      );
    }
  }

  async function submitWithAdmin(event) {
    event.preventDefault();
    await mutate(
      () => superadminApi.createEstablishmentWithAdmin({
        establishment: establishmentPayload(),
        admin: formAdmin,
      }),
      'Establecimiento y administrador creados',
      [establishments.reload, ...userReloaders, establishmentChoices.reload],
    );
    setFormAdmin(EMPTY_ADMIN);
    setFormEstablishment(EMPTY_ESTABLISHMENT);
  }

  async function submitUser(event) {
    event.preventDefault();
    if (!formUser.establishmentId) {
      setErrors({ establishmentId: 'Seleccione un establecimiento' });
      return;
    }
    const common = {
      name: formUser.name,
      email: formUser.email,
      role: formUser.role,
      active: formUser.active,
      establishmentId: Number(formUser.establishmentId),
    };
    if (formUser.id) {
      await mutate(
        () => usersApi.update(formUser.id, common),
        'Usuario actualizado',
        userReloaders,
      );
    } else {
      await mutate(
        () => usersApi.create({ ...common, password: formUser.password }),
        'Usuario creado',
        userReloaders,
      );
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (formPassword.password !== formPassword.confirm) {
      setErrors({ password: 'Las contraseñas no coinciden' });
      return;
    }
    await mutate(
      () => usersApi.resetPassword(formPassword.id, formPassword.password),
      'Contraseña restablecida. Deberá cambiarla al iniciar sesión.',
      userReloaders,
    );
  }

  const headerDescriptions = {
    resumen: 'Gestione establecimientos y cuentas de STOCKALERT. El inventario de cada negocio permanece aislado.',
    establecimientos: 'Alta, edición, estado y usuarios asignados de cada comercio.',
    usuarios: 'Cada cuenta pertenece a un establecimiento y solo ve el inventario de ese comercio.',
  };
  const headerActions = tab === 'establecimientos' ? (
    <div className="page-header__actions">
      <Button variant="secondary" icon={Plus} onClick={() => openEstablishment(null)}>Nuevo establecimiento</Button>
      <Button icon={ShieldCheck} onClick={() => setWithAdminModal(true)}>Alta con administrador</Button>
    </div>
  ) : tab === 'usuarios' ? (
    <Button icon={Plus} onClick={() => openUser(null)}>Nuevo usuario</Button>
  ) : null;

  return (
    <div className="superadmin-page">
      <PageHeader
        title="Administración general"
        description={headerDescriptions[tab]}
        actions={headerActions}
      />

      <div className="tabs superadmin-tabs">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'active' : ''}
            onClick={() => changeTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <>
          <div className="stats-grid">
            <Stat icon={Building2} label="Establecimientos" value={stats.data?.data?.total_establishments} tone="blue" />
            <Stat icon={Building2} label="Establecimientos activos" value={stats.data?.data?.active_establishments} tone="green" />
            <Stat icon={ShieldCheck} label="Administradores" value={stats.data?.data?.total_admins} tone="cyan" />
            <Stat icon={UserCog} label="Encargados" value={stats.data?.data?.total_managers} tone="orange" />
            <Stat icon={Users} label="Usuarios de consulta" value={stats.data?.data?.total_readonly} tone="blue" />
            <Stat icon={Users} label="Usuarios activos" value={stats.data?.data?.active_users} tone="green" />
            <Stat icon={Users} label="Usuarios inactivos" value={stats.data?.data?.inactive_users} tone="orange" />
          </div>
          <Card>
            <CardHeader title="Estado de la plataforma" subtitle="Métricas globales de administración" />
            <CardBody>
              <p className="info-box">
                Cada establecimiento tiene productos, movimientos, alertas, indicadores, reportes y
                conversaciones de IA completamente separados. El superadministrador no consulta ese
                inventario privado.
              </p>
            </CardBody>
          </Card>
        </>
      )}

      {tab === 'establecimientos' && (
        <Card>
          <CardHeader title="Establecimientos" subtitle="Alta, edición, estado y usuarios asignados" />
          <CardBody>
            <div className="filters-bar">
              <div className="search-box"><Search size={16} /><Input placeholder="Buscar establecimiento" value={estQ} onChange={(e) => { setEstQ(e.target.value); setEstPage(1); }} /></div>
            </div>
            <Table
              columns={establishmentColumns}
              rows={establishmentRows}
              loading={establishments.loading}
              emptyMessage="No hay establecimientos registrados"
            />
            <Pagination meta={establishments.data?.meta} onChange={setEstPage} />
          </CardBody>
        </Card>
      )}

      {tab === 'usuarios' && (
        <>
          <Card>
            <CardHeader
              title="Usuarios del sistema"
              subtitle="Cuentas de todos los establecimientos"
            />
          </Card>
          <div className="filters-bar">
            <div className="search-box"><Search size={16} /><Input placeholder="Buscar por nombre o correo" value={usrQ} onChange={(e) => { setUsrQ(e.target.value); setUsrPage(1); }} /></div>
            <Select value={usrRole} onChange={(e) => { setUsrRole(e.target.value); setUsrPage(1); }}>
              <option value="">Todos los roles</option>
              {MANAGEABLE_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <Select value={usrActive} onChange={(e) => { setUsrActive(e.target.value); setUsrPage(1); }}>
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
            <Select value={usrEstablishment} onChange={(e) => { setUsrEstablishment(e.target.value); setUsrPage(1); }}>
              <option value="">Todos los establecimientos</option>
              {establishmentOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' (inactivo)'}</option>
              ))}
            </Select>
          </div>

          {grouped ? (
            <>
              <div className="user-groups">
                {groups.map((group) => (
                  <Card key={group.key}>
                    <CardHeader
                      title={<><Building2 size={18} /> {group.name}</>}
                      subtitle={`${group.users.length} ${group.users.length === 1 ? 'usuario' : 'usuarios'}`}
                      action={<Badge tone={group.key === 'none' ? 'neutral' : 'info'}>{group.key === 'none' ? 'Sin establecimiento' : `#${group.key}`}</Badge>}
                    />
                    <CardBody>
                      <Table columns={userColumns} rows={group.users} loading={groupedUsers.loading} emptyMessage="Sin usuarios" />
                    </CardBody>
                  </Card>
                ))}
                {!groupedUsers.loading && groups.length === 0 && (
                  <Card><CardBody><p className="muted">No se encontraron usuarios con los filtros actuales.</p></CardBody></Card>
                )}
              </div>
              <p className="cell-sub">La vista agrupada muestra hasta 100 usuarios. Desactívala para paginar el listado completo.</p>
            </>
          ) : (
            <Card>
              <CardBody>
                <Table
                  columns={userColumns}
                  rows={userRows}
                  loading={users.loading}
                  emptyMessage="No hay usuarios para los filtros seleccionados"
                />
                <Pagination meta={users.data?.meta} onChange={setUsrPage} />
              </CardBody>
            </Card>
          )}

          <label className="checkbox-field view-toggle">
            <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
            Agrupar usuarios por establecimiento
          </label>
          <RolesLegend />
        </>
      )}

      <Modal
        open={establishmentModal}
        onClose={() => setEstablishmentModal(false)}
        title={formEstablishment.id ? 'Editar establecimiento' : 'Nuevo establecimiento'}
        subtitle="Los datos de contacto son administrativos; no exponen inventario."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEstablishmentModal(false)}>Cancelar</Button>
            <Button type="submit" form="establishment-form" loading={saving}>Guardar</Button>
          </>
        )}
      >
        <form id="establishment-form" className="form-stack" onSubmit={submitEstablishment}>
          <Field label="Nombre comercial" error={errors.name}>
            <Input value={formEstablishment.name} onChange={(e) => setFormEstablishment({ ...formEstablishment, name: e.target.value })} required />
          </Field>
          <div className="form-row">
            <Field label="NIT o identificación">
              <Input value={formEstablishment.taxId} onChange={(e) => setFormEstablishment({ ...formEstablishment, taxId: e.target.value })} />
            </Field>
            <Field label="Teléfono">
              <Input value={formEstablishment.phone} onChange={(e) => setFormEstablishment({ ...formEstablishment, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Correo de contacto">
            <Input type="email" value={formEstablishment.email} onChange={(e) => setFormEstablishment({ ...formEstablishment, email: e.target.value })} />
          </Field>
          <Field label="Dirección">
            <Textarea value={formEstablishment.address} onChange={(e) => setFormEstablishment({ ...formEstablishment, address: e.target.value })} />
          </Field>
          <label className="checkbox-field">
            <input type="checkbox" checked={formEstablishment.active} onChange={(e) => setFormEstablishment({ ...formEstablishment, active: e.target.checked })} />
            Establecimiento activo
          </label>
        </form>
      </Modal>

      <Modal
        open={withAdminModal}
        onClose={() => setWithAdminModal(false)}
        title="Crear establecimiento con administrador"
        subtitle="El administrador recibirá una contraseña inicial que deberá cambiar al ingresar."
        size="lg"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setWithAdminModal(false)}>Cancelar</Button>
            <Button type="submit" form="with-admin-form" loading={saving}>Crear establecimiento y administrador</Button>
          </>
        )}
      >
        <form id="with-admin-form" className="form-stack" onSubmit={submitWithAdmin}>
          <h3 className="form-section-title">Establecimiento</h3>
          <Field label="Nombre comercial">
            <Input value={formEstablishment.name} onChange={(e) => setFormEstablishment({ ...formEstablishment, name: e.target.value })} required />
          </Field>
          <div className="form-row">
            <Field label="NIT o identificación">
              <Input value={formEstablishment.taxId} onChange={(e) => setFormEstablishment({ ...formEstablishment, taxId: e.target.value })} />
            </Field>
            <Field label="Correo de contacto">
              <Input type="email" value={formEstablishment.email} onChange={(e) => setFormEstablishment({ ...formEstablishment, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Dirección">
            <Textarea value={formEstablishment.address} onChange={(e) => setFormEstablishment({ ...formEstablishment, address: e.target.value })} />
          </Field>
          <h3 className="form-section-title">Administrador asignado</h3>
          <div className="form-row">
            <Field label="Nombre">
              <Input value={formAdmin.name} onChange={(e) => setFormAdmin({ ...formAdmin, name: e.target.value })} required />
            </Field>
            <Field label="Correo electrónico">
              <Input type="email" value={formAdmin.email} onChange={(e) => setFormAdmin({ ...formAdmin, email: e.target.value })} required />
            </Field>
          </div>
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres. No se mostrará nuevamente.">
            <Input type="password" autoComplete="new-password" value={formAdmin.password} onChange={(e) => setFormAdmin({ ...formAdmin, password: e.target.value })} minLength={8} required />
          </Field>
        </form>
      </Modal>

      <Modal
        open={userModal}
        onClose={() => setUserModal(false)}
        title={formUser.id ? 'Editar usuario' : 'Nuevo usuario'}
        subtitle="La cuenta queda asociada al establecimiento seleccionado."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setUserModal(false)}>Cancelar</Button>
            <Button type="submit" form="user-form" loading={saving}>Guardar</Button>
          </>
        )}
      >
        <form id="user-form" className="form-stack" onSubmit={submitUser}>
          <div className="form-row">
            <Field label="Nombre">
              <Input value={formUser.name} onChange={(e) => setFormUser({ ...formUser, name: e.target.value })} required />
            </Field>
            <Field label="Correo electrónico">
              <Input type="email" value={formUser.email} onChange={(e) => setFormUser({ ...formUser, email: e.target.value })} required />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Rol">
              <Select value={formUser.role} onChange={(e) => setFormUser({ ...formUser, role: e.target.value })}>
                {MANAGEABLE_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            </Field>
            <Field label="Establecimiento" error={errors.establishmentId} hint="Determina qué inventario podrá ver el usuario.">
              <Select value={formUser.establishmentId} onChange={(e) => setFormUser({ ...formUser, establishmentId: e.target.value })} required>
                <option value="">Seleccione...</option>
                {establishmentOptions.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={!item.active && String(item.id) !== formUser.establishmentId}
                  >
                    {item.name}{item.active ? '' : ' (inactivo)'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {!formUser.id && (
            <Field label="Contraseña inicial" hint="Mínimo 8 caracteres. El usuario deberá cambiarla al ingresar.">
              <Input type="password" autoComplete="new-password" value={formUser.password} onChange={(e) => setFormUser({ ...formUser, password: e.target.value })} minLength={8} required />
            </Field>
          )}
          <label className="checkbox-field">
            <input type="checkbox" checked={formUser.active} onChange={(e) => setFormUser({ ...formUser, active: e.target.checked })} />
            Cuenta activa
          </label>
        </form>
      </Modal>

      <Modal
        open={passwordModal}
        onClose={() => setPasswordModal(false)}
        title="Restablecer contraseña"
        subtitle="Las sesiones anteriores quedarán invalidadas."
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setPasswordModal(false)}>Cancelar</Button>
            <Button type="submit" form="password-form" loading={saving}>Restablecer</Button>
          </>
        )}
      >
        <form id="password-form" className="form-stack" onSubmit={submitPassword}>
          <Field label="Nueva contraseña" error={errors.password}>
            <Input type="password" autoComplete="new-password" value={formPassword.password} onChange={(e) => setFormPassword({ ...formPassword, password: e.target.value })} minLength={8} required />
          </Field>
          <Field label="Confirmar contraseña">
            <Input type="password" autoComplete="new-password" value={formPassword.confirm} onChange={(e) => setFormPassword({ ...formPassword, confirm: e.target.value })} minLength={8} required />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(usersModal)}
        onClose={() => setUsersModal(null)}
        title={`Usuarios de ${usersModal?.establishment?.name || ''}`}
        size="md"
        footer={(
          <Button variant="secondary" onClick={() => setUsersModal(null)}>Cerrar</Button>
        )}
      >
        <Table
          columns={[
            { key: 'name', label: 'Nombre', render: (row) => <><strong>{row.name}</strong><span className="cell-sub">{row.email}</span></> },
            { key: 'role', label: 'Rol', render: (row) => row.role },
            {
              key: 'active', label: 'Estado',
              render: (row) => <Badge tone={row.active ? 'info' : 'danger'}>{row.active ? 'Activo' : 'Inactivo'}</Badge>,
            },
          ]}
          rows={usersModal?.rows || []}
          emptyMessage="Este establecimiento aún no tiene usuarios"
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.action()}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        loading={saving}
      />
    </div>
  );
}
