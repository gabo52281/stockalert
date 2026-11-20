import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, History, RotateCcw, Search } from 'lucide-react';
import { movementsApi, productsApi, suppliersApi, usersApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { daysAgoISO, formatDateTime, formatNumber, todayISO } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

const emptyEntry = () => ({ productId: '', quantity: 1, supplierId: '', notes: '', movementDate: todayISO() });
const emptyExit = () => ({ productId: '', quantity: 1, reason: '', notes: '', movementDate: todayISO() });

export default function MovementsPage() {
  const { hasPermission } = useAuth();
  const { success, error: notifyError } = useToast();
  const canCreate = hasPermission('movements:create');
  const [tab, setTab] = useState(canCreate ? 'in' : 'history');

  const [entry, setEntry] = useState(emptyEntry());
  const [exit, setExit] = useState(emptyExit());
  const [saving, setSaving] = useState(false);

  const [filters, setFilters] = useState({
    type: '', productId: '', userId: '', from: daysAgoISO(30), to: todayISO(), page: 1, limit: 10,
  });
  const { data, loading, reload } = useApi(
    () => movementsApi.list({
      ...filters,
      type: filters.type || undefined,
      productId: filters.productId || undefined,
      userId: filters.userId || undefined,
      from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : undefined,
    }),
    [filters],
  );

  const { data: productsData } = useApi(() => productsApi.list({ status: 'active', limit: 100 }), []);
  const { data: suppliersData } = useApi(() => suppliersApi.list({ status: 'active', limit: 100 }), []);
  const { data: usersData } = useApi(() => usersApi.list({ limit: 100 }), []);

  const selectedProduct = (id) => productsData?.data?.find((product) => String(product.id) === String(id));

  const submit = async (event, type) => {
    event.preventDefault();
    setSaving(true);
    try {
      const source = type === 'IN' ? entry : exit;
      const payload = {
        productId: Number(source.productId),
        quantity: Number(source.quantity),
        notes: source.notes || null,
        movementDate: source.movementDate ? new Date(`${source.movementDate}T12:00:00`).toISOString() : undefined,
      };
      if (type === 'IN') payload.supplierId = source.supplierId ? Number(source.supplierId) : null;
      else payload.reason = source.reason;

      const response = type === 'IN' ? await movementsApi.entry(payload) : await movementsApi.exit(payload);
      success(`${type === 'IN' ? 'Entrada' : 'Salida'} registrada. Stock resultante: ${formatNumber(response.data.product.quantity)} unidades.`);
      if (type === 'IN') setEntry(emptyEntry()); else setExit(emptyExit());
      reload();
      window.dispatchEvent(new Event('stockalert:refresh-alerts'));
    } catch (err) { notifyError(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'movement_date', label: 'Fecha', render: (row) => formatDateTime(row.movement_date) },
    { key: 'type', label: 'Tipo', render: (row) => <StatusPill value={row.type} /> },
    { key: 'product_name', label: 'Producto', render: (row) => <><strong>{row.product_name}</strong><small className="cell-sub">{row.product_code}</small></> },
    { key: 'quantity', label: 'Cantidad', align: 'right', render: (row) => formatNumber(row.quantity) },
    { key: 'stock_before', label: 'Stock anterior', align: 'right', render: (row) => formatNumber(row.stock_before) },
    { key: 'stock_after', label: 'Stock resultante', align: 'right', render: (row) => formatNumber(row.stock_after) },
    { key: 'user_name', label: 'Responsable' },
    { key: 'reason', label: 'Motivo / proveedor', render: (row) => row.reason || row.supplier_name || '—' },
  ];

  const productOptions = productsData?.data || [];

  return (
    <>
      <PageHeader title="Movimientos de inventario" description="Cada operación actualiza el stock y conserva su historial en una sola transacción." />

      <div className="tabs">
        {canCreate && <button type="button" className={tab === 'in' ? 'active' : ''} onClick={() => setTab('in')}><ArrowDownToLine size={16} /> Registrar entrada</button>}
        {canCreate && <button type="button" className={tab === 'out' ? 'active' : ''} onClick={() => setTab('out')}><ArrowUpFromLine size={16} /> Registrar salida</button>}
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={16} /> Historial</button>
      </div>

      {tab === 'in' && (
        <div className="grid-2">
          <Card>
            <CardHeader title="Nueva entrada" subtitle="Aumenta las existencias de un producto" />
            <CardBody>
              <form onSubmit={(event) => submit(event, 'IN')} className="form-stack">
                <Field label="Producto">
                  <Select required value={entry.productId} onChange={(event) => setEntry({ ...entry, productId: event.target.value })}>
                    <option value="">Seleccione un producto</option>
                    {productOptions.map((product) => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}
                  </Select>
                </Field>
                {entry.productId && (
                  <div className="info-box"><span>Stock actual: <strong>{formatNumber(selectedProduct(entry.productId)?.quantity || 0)}</strong> unidades</span></div>
                )}
                <div className="form-row">
                  <Field label="Cantidad">
                    <Input type="number" min="0.001" step="0.001" required value={entry.quantity} onChange={(event) => setEntry({ ...entry, quantity: event.target.value })} />
                  </Field>
                  <Field label="Fecha">
                    <Input type="date" required value={entry.movementDate} onChange={(event) => setEntry({ ...entry, movementDate: event.target.value })} />
                  </Field>
                </div>
                <Field label="Proveedor (opcional)">
                  <Select value={entry.supplierId} onChange={(event) => setEntry({ ...entry, supplierId: event.target.value })}>
                    <option value="">Sin proveedor</option>
                    {suppliersData?.data?.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </Select>
                </Field>
                <Field label="Observaciones"><Textarea rows={3} value={entry.notes} onChange={(event) => setEntry({ ...entry, notes: event.target.value })} placeholder="Ej. Reposición pedido mensual" /></Field>
                <Button type="submit" icon={ArrowDownToLine} loading={saving}>Registrar entrada</Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Nueva salida" subtitle="Descuenta existencias y exige un motivo" />
            <CardBody>
              <form onSubmit={(event) => submit(event, 'OUT')} className="form-stack">
                <Field label="Producto">
                  <Select required value={exit.productId} onChange={(event) => setExit({ ...exit, productId: event.target.value })}>
                    <option value="">Seleccione un producto</option>
                    {productOptions.map((product) => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}
                  </Select>
                </Field>
                {exit.productId && (
                  <div className="info-box"><span>Stock actual: <strong>{formatNumber(selectedProduct(exit.productId)?.quantity || 0)}</strong> unidades</span></div>
                )}
                <div className="form-row">
                  <Field label="Cantidad">
                    <Input type="number" min="0.001" step="0.001" required value={exit.quantity} onChange={(event) => setExit({ ...exit, quantity: event.target.value })} />
                  </Field>
                  <Field label="Fecha">
                    <Input type="date" required value={exit.movementDate} onChange={(event) => setExit({ ...exit, movementDate: event.target.value })} />
                  </Field>
                </div>
                <Field label="Motivo de salida">
                  <Input required value={exit.reason} onChange={(event) => setExit({ ...exit, reason: event.target.value })} placeholder="Ej. Venta, merma, devolución" />
                </Field>
                <Field label="Observaciones"><Textarea rows={3} value={exit.notes} onChange={(event) => setExit({ ...exit, notes: event.target.value })} /></Field>
                <Button type="submit" variant="warning" icon={ArrowUpFromLine} loading={saving}>Registrar salida</Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <Card>
          <CardBody>
            <div className="filters-bar">
              <Select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value, page: 1 })}>
                <option value="">Todos los tipos</option><option value="IN">Entradas</option><option value="OUT">Salidas</option>
              </Select>
              <Select value={filters.productId} onChange={(event) => setFilters({ ...filters, productId: event.target.value, page: 1 })}>
                <option value="">Todos los productos</option>
                {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </Select>
              <Select value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value, page: 1 })}>
                <option value="">Todos los usuarios</option>
                {usersData?.data?.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </Select>
              <div className="date-range">
                <Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value, page: 1 })} />
                <span>—</span>
                <Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value, page: 1 })} />
              </div>
              <Button variant="ghost" icon={RotateCcw} onClick={() => setFilters({ type: '', productId: '', userId: '', from: daysAgoISO(30), to: todayISO(), page: 1, limit: 10 })}>
                Limpiar
              </Button>
            </div>
            <Table columns={columns} rows={data?.data} loading={loading} emptyMessage="No hay movimientos para los filtros seleccionados" />
            <Pagination meta={data?.meta} onChange={(page) => setFilters({ ...filters, page })} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
