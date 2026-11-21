import { useState } from 'react';
import {
  Building2, KeyRound, Plus, Search, ShieldCheck, UserCog, Users,
} from 'lucide-react';
import { superadminApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatDate } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';

const ROLES = [
  { value: 'ADMINISTRADOR', label: 'Administrador' },
  { value: 'ENCARGADO_INVENTARIO', label: 'Encargado de inventario' },
  { value: 'CONSULTA', label: 'Consulta' },
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

export default function SuperadminPage() {
  const { success, error: notifyError } = useToast();
  const [tab, setTab] = useState('resumen');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [establishmentFilter, setEstablishmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounce(q, 350);

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
    () => superadminApi.establishments({ page, limit: 10, q: debouncedQ }),
    [page, debouncedQ],
  );
  const users = useApi(
    () => superadminApi.allUsers({
      page, limit: 10, q: debouncedQ, role: role || undefined,
      establishmentId: establishmentFilter || undefined,
    }),
    [page, debouncedQ, role, establishmentFilter],
  );

  const establishmentOptions = establishments.data?.data || [];
  const userRows = users.data?.data || [];
  const establishmentRows = establishmentOptions;

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
                [establishments.reload, stats.reload],
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
      render: (row) => <Badge tone={row.role === 'ADMINISTRADOR' ? 'info' : 'neutral'}>{row.roleLabel || row.role}</Badge>,
    },
    { key: 'establishment_name', label: 'Establecimiento', render: (row) => row.establishment_name || '—' },
    {
      key: 'active', label: 'Estado',
      render: (row) => <Badge tone={row.active ? 'info' : 'danger'}>{row.active ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions', label: 'Acciones', align: 'right',
      render: (row) => (
        <div className="row-actions">
          <Button size="sm" variant="ghost" onClick={() => openUser(row)}>Editar</Button>
          <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => openPassword(row)}>Contraseña</Button>
          <Button
            size="sm"
            variant={row.active ? 'warning' : 'secondary'}
            onClick={() => setConfirm({
              title: row.active ? '¿Desactivar usuario?' : '¿Activar usuario?',
              message: `${row.name} ${row.active ? 'no podrá iniciar sesión' : 'podrá iniciar sesión nuevamente'}.`,
              confirmLabel: row.active ? 'Desactivar' : 'Activar',
              danger: row.active,
              action: () => mutate(
                () => superadminApi.setUserActive(row.id, !row.active),
                'Estado del usuario actualizado',
                [users.reload, stats.reload],
              ),
            })}
          >
            {row.active ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
  ];

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
    setFormUser({
      id: row?.id,
      name: row?.name || '',
      email: row?.email || '',
      password: '',
      role: row?.role || 'ENCARGADO_INVENTARIO',
      establishmentId: row?.establishment_id ? String(row.establishment_id) : '',
      active: row?.active ?? true,
    });
    setErrors({});
    setUserModal(true);
  }

  function openPassword(row) {
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
        [establishments.reload, stats.reload],
      );
    } else {
      await mutate(
        () => superadminApi.createEstablishment(payload),
        'Establecimiento creado con configuración inicial',
        [establishments.reload, stats.reload],
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
      [establishments.reload, users.reload, stats.reload],
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
        () => superadminApi.updateUser(formUser.id, common),
        'Usuario actualizado',
        [users.reload, stats.reload],
      );
    } else {
      await mutate(
        () => superadminApi.createUser({ ...common, password: formUser.password }),
        'Usuario creado',
        [users.reload, stats.reload],
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
      () => superadminApi.resetUserPassword(formPassword.id, formPassword.password),
      'Contraseña restablecida. Deberá cambiarla al iniciar sesión.',
      [users.reload],
    );
  }

  return (
    <div className="superadmin-page">
      <PageHeader
        title="Administración general"
        description="Gestione establecimientos y cuentas de STOCKALERT. El inventario de cada negocio permanece aislado."
        actions={(
          <div className="page-header__actions">
            <Button variant="secondary" icon={Plus} onClick={() => openEstablishment(null)}>Nuevo establecimiento</Button>
            <Button icon={ShieldCheck} onClick={() => setWithAdminModal(true)}>Alta con administrador</Button>
          </div>
        )}
      />

      <div className="tabs superadmin-tabs">
        {[
          ['resumen', 'Resumen'],
          ['establecimientos', 'Establecimientos'],
          ['usuarios', 'Usuarios'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'active' : ''}
            onClick={() => setTab(value)}
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
              <div className="search-box"><Search size={16} /><Input placeholder="Buscar establecimiento" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
            </div>
            <Table
              columns={establishmentColumns}
              rows={establishmentRows}
              loading={establishments.loading}
              emptyMessage="No hay establecimientos registrados"
            />
            <Pagination meta={establishments.data?.meta} onChange={setPage} />
          </CardBody>
        </Card>
      )}

      {tab === 'usuarios' && (
        <Card>
          <CardHeader
            title="Usuarios del sistema"
            subtitle="Cuentas de todos los establecimientos"
            action={<Button icon={Plus} onClick={() => openUser(null)}>Nuevo usuario</Button>}
          />
          <CardBody>
            <div className="filters-bar">
              <div className="search-box"><Search size={16} /><Input placeholder="Buscar por nombre o correo" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
              <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
                <option value="">Todos los roles</option>
                {ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
              <Select value={establishmentFilter} onChange={(e) => { setEstablishmentFilter(e.target.value); setPage(1); }}>
                <option value="">Todos los establecimientos</option>
                {establishmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </div>
            <Table
              columns={userColumns}
              rows={userRows}
              loading={users.loading}
              emptyMessage="No hay usuarios para los filtros seleccionados"
            />
            <Pagination meta={users.data?.meta} onChange={setPage} />
          </CardBody>
        </Card>
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
                {ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            </Field>
            <Field label="Establecimiento" error={errors.establishmentId}>
              <Select value={formUser.establishmentId} onChange={(e) => setFormUser({ ...formUser, establishmentId: e.target.value })} required>
                <option value="">Seleccione...</option>
                {establishmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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
