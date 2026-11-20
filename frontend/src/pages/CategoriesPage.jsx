import { useMemo, useState } from 'react';
import { Archive, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { categoriesApi } from '../api/endpoints.js';
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
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

const EMPTY = { name: '', description: '', active: true };

export default function CategoriesPage() {
  const { hasPermission } = useAuth();
  const { success, error: notifyError } = useToast();
  const [filters, setFilters] = useState({ q: '', status: 'active', page: 1, limit: 10 });
  const debounced = useDebounce(filters.q, 350);
  const query = useMemo(() => ({ ...filters, q: debounced || undefined }), [filters, debounced]);
  const { data, loading, reload } = useApi(() => categoriesApi.list(query), [query]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name, description: row.description || '', active: row.active });
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) await categoriesApi.update(editing.id, form);
      else await categoriesApi.create(form);
      success(editing ? 'Categoría actualizada' : 'Categoría creada');
      setOpen(false);
      reload();
    } catch (err) { notifyError(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const execute = async () => {
    try {
      if (confirm.action === 'toggle') await categoriesApi.setActive(confirm.row.id, !confirm.row.active);
      else await categoriesApi.remove(confirm.row.id);
      success(confirm.action === 'toggle' ? 'Estado actualizado' : 'Categoría eliminada');
      setConfirm(null);
      reload();
    } catch (err) { notifyError(errorMessage(err)); }
  };

  const columns = [
    { key: 'name', label: 'Categoría', render: (row) => <strong>{row.name}</strong> },
    { key: 'description', label: 'Descripción', render: (row) => row.description || '—' },
    { key: 'products_count', label: 'Productos', align: 'right', render: (row) => row.products_count },
    { key: 'active', label: 'Estado', render: (row) => <StatusPill value={row.active ? 'active' : 'inactive'} /> },
    {
      key: 'actions', label: 'Acciones', align: 'right',
      render: (row) => (
        <div className="row-actions">
          {hasPermission('categories:update') && <button type="button" title="Editar" onClick={() => openEdit(row)}><Pencil size={16} /></button>}
          {hasPermission('categories:deactivate') && <button type="button" title={row.active ? 'Desactivar' : 'Activar'} onClick={() => setConfirm({ action: 'toggle', row })}><Archive size={16} /></button>}
          {hasPermission('categories:delete') && <button type="button" title="Eliminar" onClick={() => setConfirm({ action: 'delete', row })}><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Organice los productos en grupos para facilitar su consulta."
        actions={hasPermission('categories:create') && <Button icon={Plus} onClick={openCreate}>Nueva categoría</Button>}
      />
      <Card>
        <CardBody>
          <div className="filters-bar">
            <div className="search-box"><Search size={17} />
              <Input placeholder="Buscar categoría…" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
            </div>
            <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="active">Activas</option><option value="inactive">Inactivas</option><option value="all">Todas</option>
            </Select>
          </div>
          <Table columns={columns} rows={data?.data} loading={loading} emptyMessage="No hay categorías registradas" />
          <Pagination meta={data?.meta} onChange={(page) => setFilters({ ...filters, page })} />
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'} size="sm"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="category-form" loading={saving}>Guardar</Button></>}>
        <form id="category-form" onSubmit={submit} className="form-stack">
          <Field label="Nombre"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Descripción"><Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Categoría activa</label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={execute}
        title={confirm?.action === 'delete' ? 'Eliminar categoría' : 'Cambiar estado'}
        message={confirm?.action === 'delete'
          ? `¿Eliminar "${confirm?.row?.name}"? No se permitirá si tiene productos asociados.`
          : `¿${confirm?.row?.active ? 'Desactivar' : 'Activar'} "${confirm?.row?.name}"?`}
      />
    </>
  );
}
