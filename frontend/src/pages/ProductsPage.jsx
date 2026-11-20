import { useEffect, useMemo, useState } from 'react';
import {
  Archive, History, Pencil, Plus, Search, Settings2, Trash2,
} from 'lucide-react';
import { categoriesApi, productsApi, suppliersApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatCurrency, formatDateTime, formatInteger } from '../utils/format.js';
import { normalizeDigits } from '../utils/numeric.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import Badge from '../components/ui/Badge.jsx';
import {
  CurrencyInput, Field, Input, IntegerInput, Select, Textarea,
} from '../components/ui/Field.jsx';

const EMPTY_FORM = {
  code: '', name: '', description: '', categoryId: '', supplierId: '',
  purchasePrice: '0', salePrice: '0', minStock: '0', alertPercentage: '25', active: true,
};

const nullableNumber = (value) => (value === '' || value === null || value === undefined ? null : Number(value));
const apiNumber = (value) => (value === '' || value === null || value === undefined ? '' : Number(value));

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const { success, error: notifyError } = useToast();
  const canCreate = hasPermission('products:create');
  const canEdit = hasPermission('products:update');
  const canDeactivate = hasPermission('products:deactivate');
  const canDelete = hasPermission('products:delete');

  const [filters, setFilters] = useState({ q: '', categoryId: '', status: 'active', alertLevel: '', page: 1, limit: 10 });
  const debouncedSearch = useDebounce(filters.q, 350);
  const query = useMemo(() => ({
    ...filters,
    q: debouncedSearch || undefined,
    categoryId: nullableNumber(filters.categoryId) || undefined,
    alertLevel: filters.alertLevel || undefined,
  }), [filters, debouncedSearch]);

  const { data, loading, reload } = useApi(() => productsApi.list(query), [query]);
  const { data: categoriesData } = useApi(() => categoriesApi.list({ status: 'all', limit: 100 }), []);
  const { data: suppliersData } = useApi(() => suppliersApi.list({ status: 'all', limit: 100 }), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ preventivePercentage: '25', analysisWindowDays: '30', minHistoryDays: '7' });
  const [confirm, setConfirm] = useState(null);

  useEffect(() => { setFilters((current) => ({ ...current, page: 1 })); }, [debouncedSearch, filters.categoryId, filters.status, filters.alertLevel]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (product) => {
    setEditing(product);
    setForm({
      code: product.code, name: product.name, description: product.description || '',
      categoryId: product.category_id || '', supplierId: product.supplier_id || '',
      purchasePrice: normalizeDigits(product.purchase_price),
      salePrice: normalizeDigits(product.sale_price),
      minStock: normalizeDigits(product.min_stock),
      alertPercentage: normalizeDigits(product.alert_percentage),
      active: product.active,
    });
    setFormOpen(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      code: form.code.trim(), name: form.name.trim(),
      categoryId: nullableNumber(form.categoryId), supplierId: nullableNumber(form.supplierId),
      purchasePrice: apiNumber(form.purchasePrice), salePrice: apiNumber(form.salePrice),
      minStock: apiNumber(form.minStock), alertPercentage: apiNumber(form.alertPercentage),
    };
    try {
      if (editing) {
        await productsApi.update(editing.id, payload);
        success('Producto actualizado');
      } else {
        await productsApi.create(payload);
        success('Producto creado. Registre una entrada inicial para asignar existencias.');
      }
      setFormOpen(false);
      reload();
      window.dispatchEvent(new Event('stockalert:refresh-alerts'));
    } catch (err) {
      notifyError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (product) => {
    setEditing(product);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const response = await productsApi.history(product.id);
      setHistory(response.data);
    } catch (err) { notifyError(errorMessage(err)); }
    finally { setHistoryLoading(false); }
  };

  const openSettings = (product) => {
    setEditing(product);
    setSettings({
      preventivePercentage: normalizeDigits(product.effective_percentage),
      analysisWindowDays: normalizeDigits(product.effective_window_days),
      minHistoryDays: '7',
    });
    setSettingsOpen(true);
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    try {
      await productsApi.setAlertSettings(editing.id, {
        preventivePercentage: apiNumber(settings.preventivePercentage),
        analysisWindowDays: apiNumber(settings.analysisWindowDays),
        minHistoryDays: apiNumber(settings.minHistoryDays),
      });
      success('Configuración de alertas actualizada');
      setSettingsOpen(false);
      reload();
    } catch (err) { notifyError(errorMessage(err)); }
  };

  const executeConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === 'toggle') await productsApi.setActive(confirm.product.id, !confirm.product.active);
      if (confirm.action === 'delete') await productsApi.remove(confirm.product.id);
      success(confirm.action === 'delete' ? 'Producto eliminado' : 'Estado del producto actualizado');
      setConfirm(null);
      reload();
      window.dispatchEvent(new Event('stockalert:refresh-alerts'));
    } catch (err) { notifyError(errorMessage(err)); }
  };

  const columns = [
    { key: 'code', label: 'Código', render: (row) => <strong className="mono">{row.code}</strong> },
    { key: 'name', label: 'Producto', render: (row) => (<><strong>{row.name}</strong><small className="cell-sub">{row.category_name || 'Sin categoría'}</small></>) },
    { key: 'quantity', label: 'Existencia', align: 'right', render: (row) => <strong>{formatInteger(row.quantity)}</strong> },
    { key: 'min_stock', label: 'Mínimo', align: 'right', render: (row) => formatInteger(row.min_stock) },
    { key: 'alert_level', label: 'Estado', render: (row) => <StatusPill value={row.alert_level} /> },
    { key: 'sale_price', label: 'Precio venta', align: 'right', render: (row) => formatCurrency(row.sale_price) },
    {
      key: 'actions', label: 'Acciones', align: 'right',
      render: (row) => (
        <div className="row-actions">
          <button type="button" title="Ver historial" onClick={(event) => { event.stopPropagation(); openHistory(row); }}><History size={16} /></button>
          {canEdit && <button type="button" title="Editar" onClick={(event) => { event.stopPropagation(); openEdit(row); }}><Pencil size={16} /></button>}
          {canEdit && <button type="button" title="Configurar alertas" onClick={(event) => { event.stopPropagation(); openSettings(row); }}><Settings2 size={16} /></button>}
          {canDeactivate && <button type="button" title={row.active ? 'Desactivar' : 'Activar'} onClick={(event) => { event.stopPropagation(); setConfirm({ action: 'toggle', product: row }); }}><Archive size={16} /></button>}
          {canDelete && <button type="button" title="Eliminar" onClick={(event) => { event.stopPropagation(); setConfirm({ action: 'delete', product: row }); }}><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Productos"
        description="Administre el catálogo, las existencias y las reglas de alerta por producto."
        actions={canCreate && <Button icon={Plus} onClick={openCreate}>Nuevo producto</Button>}
      />

      <Card>
        <CardBody>
          <div className="filters-bar">
            <div className="search-box">
              <Search size={17} />
              <Input placeholder="Buscar por nombre o código…" value={filters.q}
                onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
            </div>
            <Select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}>
              <option value="">Todas las categorías</option>
              {categoriesData?.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
            <Select value={filters.alertLevel} onChange={(event) => setFilters({ ...filters, alertLevel: event.target.value })}>
              <option value="">Todos los estados</option>
              <option value="NORMAL">Normal</option>
              <option value="BAJO">Stock bajo</option>
              <option value="CRITICO">Crítico</option>
              <option value="AGOTADO">Agotado</option>
            </Select>
            <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="all">Todos</option>
            </Select>
          </div>

          <Table columns={columns} rows={data?.data} loading={loading} emptyMessage="No se encontraron productos con los filtros aplicados" />
          <Pagination meta={data?.meta} onChange={(page) => setFilters({ ...filters, page })} />
        </CardBody>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        subtitle={editing ? `Código ${editing.code}` : 'El stock se asigna mediante una entrada inicial trazable.'}
        size="lg"
        footer={<><Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" form="product-form" loading={saving}>{editing ? 'Guardar cambios' : 'Crear producto'}</Button></>}
      >
        <form id="product-form" onSubmit={submitForm} className="form-grid">
          <Field label="Código único" error="Obligatorio">
            <Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="PROD-011" />
          </Field>
          <Field label="Nombre">
            <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nombre del producto" />
          </Field>
          <Field label="Categoría">
            <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              <option value="">Sin categoría</option>
              {categoriesData?.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </Field>
          <Field label="Proveedor principal">
            <Select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}>
              <option value="">Sin proveedor</option>
              {suppliersData?.data?.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </Select>
          </Field>
          <Field label="Precio de compra (COP)">
            <CurrencyInput required value={form.purchasePrice} onChange={(value) => setForm({ ...form, purchasePrice: value })} />
          </Field>
          <Field label="Precio de venta (COP)">
            <CurrencyInput required value={form.salePrice} onChange={(value) => setForm({ ...form, salePrice: value })} />
          </Field>
          <Field label="Stock mínimo" hint="Al llegar a este valor se clasifica como CRÍTICO">
            <IntegerInput required min={0} value={form.minStock} onChange={(value) => setForm({ ...form, minStock: value })} />
          </Field>
          <Field label="Porcentaje preventivo (%)" hint="Global: 25 % · define el estado BAJO">
            <IntegerInput required min={0} max={100} value={form.alertPercentage} onChange={(value) => setForm({ ...form, alertPercentage: value })} />
          </Field>
          <Field label="Descripción" className="field--full">
            <Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Detalles adicionales" />
          </Field>
          <label className="checkbox-field field--full">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Producto activo
          </label>
        </form>
      </Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Configuración de alertas"
        subtitle={editing?.name} size="sm"
        footer={<><Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancelar</Button><Button type="submit" form="settings-form">Guardar</Button></>}>
        <form id="settings-form" onSubmit={saveSettings} className="form-stack">
          <Field label="Porcentaje preventivo (%)" hint="Umbral BAJO = mínimo × (1 + porcentaje/100)">
            <IntegerInput min={0} max={100} required value={settings.preventivePercentage}
              onChange={(value) => setSettings({ ...settings, preventivePercentage: value })} />
          </Field>
          <Field label="Ventana de análisis (días)" hint="Período para calcular promedio de salidas">
            <IntegerInput min={1} max={365} required value={settings.analysisWindowDays}
              onChange={(value) => setSettings({ ...settings, analysisWindowDays: value })} />
          </Field>
          <Field label="Días mínimos de historial" hint="Para considerar la cobertura como calculable">
            <IntegerInput min={1} max={365} required value={settings.minHistoryDays}
              onChange={(value) => setSettings({ ...settings, minHistoryDays: value })} />
          </Field>
          <div className="info-box">
            <Badge tone="info">Regla configurada</Badge>
            <span>El porcentaje global es 25 %. Este valor reemplaza al global para este producto.</span>
          </div>
        </form>
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historial de movimientos" subtitle={editing?.name} size="lg">
        <Table
          columns={[
            { key: 'movement_date', label: 'Fecha', render: (row) => formatDateTime(row.movement_date) },
            { key: 'type', label: 'Tipo', render: (row) => <StatusPill value={row.type} /> },
            { key: 'quantity', label: 'Cantidad', align: 'right', render: (row) => formatInteger(row.quantity) },
            { key: 'stock_before', label: 'Stock anterior', align: 'right', render: (row) => formatInteger(row.stock_before) },
            { key: 'stock_after', label: 'Stock resultante', align: 'right', render: (row) => formatInteger(row.stock_after) },
            { key: 'user_name', label: 'Responsable' },
            { key: 'reason', label: 'Motivo' },
          ]}
          rows={history}
          loading={historyLoading}
          emptyMessage="Este producto aún no tiene movimientos"
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={executeConfirm}
        title={confirm?.action === 'delete' ? 'Eliminar producto' : 'Cambiar estado del producto'}
        message={confirm?.action === 'delete'
          ? `¿Eliminar "${confirm?.product?.name}"? Solo es posible si no tiene movimientos históricos.`
          : `¿${confirm?.product?.active ? 'Desactivar' : 'Activar'} "${confirm?.product?.name}"?`}
        confirmLabel={confirm?.action === 'delete' ? 'Eliminar' : 'Confirmar'}
      />
    </>
  );
}
