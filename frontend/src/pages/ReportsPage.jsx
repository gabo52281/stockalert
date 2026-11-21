import { useState } from 'react';
import { FileDown, FileSpreadsheet, Search } from 'lucide-react';
import {
  categoriesApi, productsApi, reportsApi, usersApi,
} from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { daysAgoISO, formatCurrency, formatNumber, todayISO } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Table from '../components/ui/Table.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';

const emptyFilters = () => ({
  from: daysAgoISO(30), to: todayISO(), productId: '', categoryId: '', userId: '', type: '', status: '',
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { success, error: notifyError } = useToast();
  const { data: catalog } = useApi(() => reportsApi.catalog().then((response) => response.data), []);
  const [report, setReport] = useState('inventory');
  const [filters, setFilters] = useState(emptyFilters());
  const [downloading, setDownloading] = useState('');
  const [hasSearched, setHasSearched] = useState(true);

  const cleanFilters = {
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : undefined,
    productId: filters.productId || undefined,
    categoryId: filters.categoryId || undefined,
    userId: filters.userId || undefined,
    type: filters.type || undefined,
    status: filters.status || undefined,
  };

  const { data, loading, reload } = useApi(
    () => hasSearched ? reportsApi.get(report, cleanFilters).then((response) => response.data) : Promise.resolve(null),
    [report, JSON.stringify(cleanFilters), hasSearched],
  );

  const { data: productsData } = useApi(() => productsApi.list({ status: 'all', limit: 100 }), []);
  const { data: categoriesData } = useApi(() => categoriesApi.list({ status: 'all', limit: 100 }), []);
  const { data: usersData } = useApi(() => usersApi.options(), []);

  const exportFile = async (format) => {
    setDownloading(format);
    try {
      const blob = await reportsApi.download(report, cleanFilters, format);
      const name = `stockalert-${report}-${new Date().toISOString().slice(0, 10)}.${format}`;
      downloadBlob(blob, name);
      success(`Archivo ${format.toUpperCase()} descargado con los filtros aplicados`);
    } catch (err) { notifyError(errorMessage(err)); }
    finally { setDownloading(''); }
  };

  const tableColumns = data?.columns?.map((column) => ({
    key: column.key,
    label: column.label,
    align: /cantidad|stock|precio|valor|unidades|salida|mínimo|cobertura|existencia/i.test(column.label) ? 'right' : undefined,
    render: (row) => {
      const value = row[column.key];
      if (value === null || value === undefined || value === '') return '—';
      if (typeof value === 'number' && /fecha/i.test(column.label)) return formatNumber(value);
      if (column.format === 'currency' || /precio|valor/i.test(column.label)) return formatCurrency(value);
      if (typeof value === 'number') return formatNumber(value);
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('es-CO');
      return value;
    },
  })) || [];

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Genere información real del inventario y expórtela a CSV o PDF."
        actions={(
          <>
            <Button variant="secondary" icon={FileSpreadsheet} loading={downloading === 'csv'} onClick={() => exportFile('csv')}>Exportar CSV</Button>
            <Button icon={FileDown} loading={downloading === 'pdf'} onClick={() => exportFile('pdf')}>Exportar PDF</Button>
          </>
        )}
      />

      <div className="grid-2">
        <Card>
          <CardHeader title="Configuración del reporte" subtitle="Seleccione el tipo y los filtros" />
          <CardBody>
            <div className="form-stack">
              <Field label="Tipo de reporte">
                <Select value={report} onChange={(event) => { setReport(event.target.value); setHasSearched(true); }}>
                  {catalog?.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}
                </Select>
              </Field>
              <div className="form-row">
                <Field label="Fecha inicial"><Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></Field>
                <Field label="Fecha final"><Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></Field>
              </div>
              <div className="form-row">
                <Field label="Producto">
                  <Select value={filters.productId} onChange={(event) => setFilters({ ...filters, productId: event.target.value })}>
                    <option value="">Todos</option>
                    {productsData?.data?.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </Select>
                </Field>
                <Field label="Categoría">
                  <Select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}>
                    <option value="">Todas</option>
                    {categoriesData?.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="form-row">
                <Field label="Usuario">
                  <Select value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value })}>
                    <option value="">Todos</option>
                    {usersData?.data?.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </Select>
                </Field>
                <Field label="Tipo de movimiento">
                  <Select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
                    <option value="">Todos</option><option value="IN">Entradas</option><option value="OUT">Salidas</option>
                  </Select>
                </Field>
              </div>
              <div className="report-actions">
                <Button icon={Search} onClick={() => { setHasSearched(true); reload(); }}>Aplicar filtros</Button>
                <Button variant="ghost" onClick={() => { setFilters(emptyFilters()); setHasSearched(true); }}>Limpiar</Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Vista previa" subtitle={data?.title || 'Datos del reporte'} />
          <CardBody>
            <Table columns={tableColumns} rows={data?.rows} loading={loading} emptyMessage="No hay datos para los filtros seleccionados" />
            <p className="table-count">{data?.rows?.length ?? 0} filas en la vista previa</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
