import { useMemo, useState } from 'react';
import { BellRing, CircleAlert, PackageX, Search, TriangleAlert } from 'lucide-react';
import { alertsApi, categoriesApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatDateTime, formatNumber } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Modal from '../components/ui/Modal.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import { Input, Select } from '../components/ui/Field.jsx';

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <div className={`summary-card summary-card--${tone}`}>
      <Icon size={22} />
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  );
}

export default function AlertsPage() {
  const { error: notifyError } = useToast();
  const [filters, setFilters] = useState({ level: '', categoryId: '', q: '', page: 1, limit: 10 });
  const debounced = useDebounce(filters.q, 350);
  const query = useMemo(() => ({
    ...filters,
    q: debounced || undefined,
    categoryId: filters.categoryId || undefined,
    level: filters.level || undefined,
  }), [filters, debounced]);

  const { data: summary } = useApi(() => alertsApi.summary().then((response) => response.data), []);
  const { data, loading } = useApi(() => alertsApi.list(query), [query]);
  const { data: categoriesData } = useApi(() => categoriesApi.list({ status: 'all', limit: 100 }), []);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (row) => {
    setDetailLoading(true);
    setDetail({ id: row.id });
    try {
      const response = await alertsApi.detail(row.id);
      setDetail(response.data);
    } catch (err) { notifyError(errorMessage(err)); }
    finally { setDetailLoading(false); }
  };

  const columns = [
    { key: 'code', label: 'Código', render: (row) => <strong className="mono">{row.code}</strong> },
    { key: 'name', label: 'Producto', render: (row) => <><strong>{row.name}</strong><small className="cell-sub">{row.category_name || 'Sin categoría'}</small></> },
    { key: 'quantity', label: 'Existencia', align: 'right', render: (row) => <strong>{formatNumber(row.quantity)}</strong> },
    { key: 'min_stock', label: 'Mínimo', align: 'right', render: (row) => formatNumber(row.min_stock) },
    { key: 'preventive_threshold', label: 'Umbral BAJO', align: 'right', render: (row) => formatNumber(row.preventive_threshold) },
    { key: 'coverage_days', label: 'Cobertura', align: 'right', render: (row) => row.coverage_days === null ? '—' : `${formatNumber(row.coverage_days)} días` },
    { key: 'alert_level', label: 'Nivel', render: (row) => <StatusPill value={row.alert_level} /> },
  ];

  return (
    <>
      <PageHeader title="Alertas preventivas" description="Clasificación determinista basada en existencias, mínimos y porcentaje preventivo." />

      <div className="summary-grid">
        <SummaryCard icon={PackageX} label="Agotados" value={summary?.out_of_stock ?? '—'} tone="out" />
        <SummaryCard icon={TriangleAlert} label="Críticos" value={summary?.critical ?? '—'} tone="critical" />
        <SummaryCard icon={CircleAlert} label="Stock bajo" value={summary?.low ?? '—'} tone="low" />
        <SummaryCard icon={BellRing} label="En atención" value={summary?.attention ?? '—'} tone="blue" />
      </div>

      <div className="rules-banner">
        <strong>Reglas aplicadas</strong>
        <span>Agotado: stock = 0 · Crítico: 0 &lt; stock ≤ mínimo · Bajo: mínimo &lt; stock ≤ mínimo × (1 + preventivo) · Normal: por encima del umbral.</span>
      </div>

      <Card>
        <CardBody>
          <div className="filters-bar">
            <div className="search-box"><Search size={17} />
              <Input placeholder="Buscar producto…" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })} />
            </div>
            <Select value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value, page: 1 })}>
              <option value="">Todos los niveles</option>
              <option value="AGOTADO">Agotado</option><option value="CRITICO">Crítico</option>
              <option value="BAJO">Stock bajo</option><option value="NORMAL">Normal</option>
            </Select>
            <Select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value, page: 1 })}>
              <option value="">Todas las categorías</option>
              {categoriesData?.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </div>

          <Table
            columns={columns}
            rows={data?.data}
            loading={loading}
            onRowClick={openDetail}
            emptyMessage="No hay productos con los filtros seleccionados"
          />
          <Pagination meta={data?.meta} onChange={(page) => setFilters({ ...filters, page })} />
        </CardBody>
      </Card>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Detalle de alerta" subtitle={detail?.code} size="lg">
        {detailLoading || !detail?.alert_level ? <p>Cargando…</p> : (
          <div className="alert-detail">
            <div className="alert-detail__head">
              <div><h3>{detail.name}</h3><p>{detail.description || 'Sin descripción'}</p></div>
              <StatusPill value={detail.alert_level} />
            </div>
            <div className="detail-grid">
              <div><span>Existencia actual</span><strong>{formatNumber(detail.quantity)}</strong></div>
              <div><span>Stock mínimo</span><strong>{formatNumber(detail.min_stock)}</strong></div>
              <div><span>Umbral preventivo</span><strong>{formatNumber(detail.preventive_threshold)}</strong></div>
              <div><span>Porcentaje aplicado</span><strong>{formatNumber(detail.effective_percentage)} %</strong></div>
              <div><span>Salida diaria promedio</span><strong>{formatNumber(detail.avg_daily_out)}</strong></div>
              <div><span>Cobertura estimada</span><strong>{detail.coverage_days === null ? 'Sin datos suficientes' : `${formatNumber(detail.coverage_days)} días`}</strong></div>
            </div>
            <h4>Últimos movimientos</h4>
            <div className="mini-list">
              {detail.recentMovements?.length ? detail.recentMovements.map((movement) => (
                <div key={movement.id} className="mini-list__row">
                  <div><strong>{movement.type === 'IN' ? 'Entrada' : 'Salida'} · {formatNumber(movement.quantity)} uds.</strong>
                    <span>{formatDateTime(movement.movement_date)} · {movement.user_name}</span></div>
                  <small>{formatNumber(movement.stock_after)} uds.</small>
                </div>
              )) : <p>No hay movimientos registrados.</p>}
            </div>
            <p className="disclaimer">La cobertura es una estimación basada en el historial, no una predicción garantizada.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
