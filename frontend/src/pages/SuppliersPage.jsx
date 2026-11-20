import { useMemo, useState } from 'react';
import { Archive, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { suppliersApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatNumber } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

const EMPTY = {
  name: '', taxId: '', phone: '', email: '', address: '', contactPerson: '', notes: '', active: true,
};

export default function SuppliersPage() {
  const { hasPermission } = useAuth();
  const { success, error: notifyError } = useToast();
  const [filters, setFilters] = useState({ q: '', status: 'active', page: 1, limit: 10 });
  const debounced = useDebounce(filters.q, 350);
  const query = useMemo(() => ({ ...filters, q: debounced || undefined }), [filters, debounced]);
  const { data, loading, reload } = useApi(() => suppliersApi.list(query), [query]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRows, setViewRows] = useState([]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name, taxId: row.tax_id || '', phone: row.phone || '', email: row.email || '',
      address: row.address || '', contactPerson: row.contact_person || '', notes: row.notes || '', active: row.active,
    });
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, taxId: form.taxId || null, email: form.email || null };
      if (editing) await suppliersApi.update(editing.id, payload);
      else await suppliersApi.create(payload);
      success(editing ? 'Proveedor actualizado' : 'Proveedor creado');
      setOpen(false);
      reload();
    } catch (err) { notifyError(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const execute = async () => {
    try {
      if (confirm.action === 'toggle') await suppliersApi.setActive(confirm.row.id, !confirm.row.active);
      else await suppliersApi.remove(confirm.row.id);
      success(confirm.action === 'toggle' ? 'Estado actualizado' : 'Proveedor eliminado');
      setConfirm(null);
      reload();
    } catch (err) { notifyError(errorMessage(err)); }
  };

  const viewProducts = async (row) => {
    try {
      const response = await suppliersApi.products(row.id);
      setViewRows(response.data);
      setEditing(row);
      setViewOpen(true);
    } catch (err) { notifyError(errorMessage(err)); }
  };

  const columns = [
    { key: 'name', label: 'Proveedor', render: (row) => <><strong>{row.name}</strong><small className="cell-sub">{row.tax_id || 'Sin identificación'}</small></> },
    { key: 'contact', label: 'Contacto', render: (row) => <>{row.contact_person || '—'}<small className="cell-sub">{row.phone || row.email || ''}</small></> },
    { key: 'products_count', label: 'Productos', align: 'right', render: (row) => row.products_count },
    { key: 'active', label: 'Estado', render: (row) => <StatusPill value={row.active ? 'active' : 'inactive'} /> },
    {
      key: 'actions', label: 'Acciones', align: 'right',
      render: (row) => (
        <div className="row-actions">
          <button type="button" title="Productos suministrados" onClick={() => viewProducts(row)}><Eye size={16} /></button>
          {hasPermission('suppliers:update') && <button type="button" title="Editar" onClick={() => openEdit(row)}><Pencil size={16} /></button>}
          {hasPermission('suppliers:deactivate') && <button type="button" title={row.active ? 'Desactivar' : 'Activar'} onClick={() => setConfirm({ action: 'toggle', row })}><Archive size={16} /></button>}
          {hasPermission('suppliers:delete') && <button type="button" title="Eliminar" onClick={() => setConfirm({ action: 'delete', row })}><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Registre y consulte los proveedores de la mercancía."
        actions={hasPermission('suppliers:create') && <Button icon={Plus} onClick={openCreate}>Nuevo proveedor</Button>}
      />
      <Card>
        <CardBody>
          <div className="filters-bar">
            <div className="search-box"><Search size={17} />
              <Input placeholder="Buscar por nombre, NIT o contacto…" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
            </div>
            <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option>
            </Select>
          </div>
          <Table columns={columns} rows={data?.data} loading={loading} emptyMessage="No hay proveedores registrados" />
          <Pagination meta={data?.meta} onChange={(page) => setFilters({ ...filters, page })} />
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'} size="lg"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="supplier-form" loading={saving}>Guardar</Button></>}>
        <form id="supplier-form" onSubmit={submit} className="form-grid">
          <Field label="Nombre o razón social"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Identificación (NIT/RUT)"><Input value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value })} /></Field>
          <Field label="Teléfono"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Correo electrónico"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Persona de contacto"><Input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} /></Field>
          <Field label="Dirección"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
          <Field label="Observaciones" className="field--full"><Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          <label className="checkbox-field field--full"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Proveedor activo</label>
        </form>
      </Modal>

      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Productos suministrados" subtitle={editing?.name} size="lg">
        <Table
          columns={[
            { key: 'code', label: 'Código' },
            { key: 'name', label: 'Producto' },
            { key: 'quantity', label: 'Existencia', align: 'right', render: (row) => formatNumber(row.quantity) },
            { key: 'alert_level', label: 'Estado', render: (row) => <StatusPill value={row.alert_level} /> },
          ]}
          rows={viewRows}
          emptyMessage="Este proveedor no tiene productos asociados"
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={execute}
        title={confirm?.action === 'delete' ? 'Eliminar proveedor' : 'Cambiar estado'}
        message={confirm?.action === 'delete'
          ? `¿Eliminar "${confirm?.row?.name}"? No se permitirá si tiene productos asociados.`
          : `¿${confirm?.row?.active ? 'Desactivar' : 'Activar'} "${confirm?.row?.name}"?`}
      />
    </>
  );
}
