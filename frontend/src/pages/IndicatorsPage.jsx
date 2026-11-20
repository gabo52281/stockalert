import { useState } from 'react';
import { Activity, CalendarClock, ChartNoAxesCombined, Coins, Package } from 'lucide-react';
import { indicatorsApi } from '../api/endpoints.js';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatInteger, formatNumber } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function IndicatorsPage() {
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const { data: summary } = useApi(() => indicatorsApi.summary(days).then((response) => response.data), [days]);
  const { data: coverage } = useApi(() => indicatorsApi.coverage({ days, page, limit: 10 }), [days, page]);
  const { data: top } = useApi(() => indicatorsApi.topProducts(days).then((response) => response.data), [days]);

  const coverageColumns = [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Producto', render: (row) => <><strong>{row.name}</strong><small className="cell-sub">{row.category_name || 'Sin categoría'}</small></> },
    { key: 'quantity', label: 'Stock', align: 'right', render: (row) => formatInteger(row.quantity) },
    { key: 'avg_daily_out', label: 'Salida diaria', align: 'right', render: (row) => formatNumber(row.avg_daily_out) },
    { key: 'coverage_status', label: 'Dato', render: (row) => <StatusPill value={row.coverage_status} /> },
    { key: 'coverage_days', label: 'Cobertura', align: 'right', render: (row) => row.coverage_days === null ? '—' : `${formatNumber(row.coverage_days)} días` },
    { key: 'alert_level', label: 'Alerta', render: (row) => <StatusPill value={row.alert_level} /> },
  ];

  return (
    <>
      <PageHeader
        title="Indicadores y cobertura"
        description="Métricas calculadas con movimientos reales de PostgreSQL."
        actions={(
          <div className="period-switch">
            {[7, 30, 90].map((option) => (
              <button key={option} type="button" className={days === option ? 'active' : ''} onClick={() => { setDays(option); setPage(1); }}>{option} días</button>
            ))}
          </div>
        )}
      />

      <div className="stats-grid">
        <Card className="stat-card stat-card--blue"><div className="stat-card__icon"><Package size={21} /></div><div><span>Referencias activas</span><strong>{formatInteger(summary?.active_products || 0)}</strong></div></Card>
        <Card className="stat-card stat-card--cyan"><div className="stat-card__icon"><Activity size={21} /></div><div><span>Unidades disponibles</span><strong>{formatInteger(summary?.total_units || 0)}</strong></div></Card>
        <Card className="stat-card stat-card--green"><div className="stat-card__icon"><Coins size={21} /></div><div><span>Valor inventario</span><strong>{formatCurrency(summary?.inventory_value || 0)}</strong></div></Card>
        <Card className="stat-card stat-card--orange"><div className="stat-card__icon"><CalendarClock size={21} /></div><div><span>Cobertura global</span><strong>{summary && summary.coverage_days !== null ? `${formatNumber(summary.coverage_days)} días` : 'Sin datos suficientes'}</strong></div></Card>
      </div>

      <div className="formula-banner">
        <ChartNoAxesCombined size={18} />
        <span>
          Promedio de salidas diarias = unidades salidas en {days} días ÷ {days}.
          Cobertura = stock actual ÷ promedio de salidas diarias.
          Se requiere al menos 7 días de historial para considerar el dato suficiente.
        </span>
      </div>

      <div className="grid-2">
        <Card>
          <CardHeader title="Cobertura estimada por producto" subtitle="Ordenado por menor cobertura" />
          <CardBody>
            <Table columns={coverageColumns} rows={coverage?.data} loading={!coverage} emptyMessage="No hay datos de cobertura" />
            <Pagination meta={coverage?.meta} onChange={setPage} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Productos con mayores salidas" subtitle={`Unidades retiradas en ${days} días`} />
          <CardBody>
            {top?.length ? (
              <div className="ranking">
                {top.map((product, index) => (
                  <div key={product.id} className="ranking__row">
                    <span className="ranking__index">{index + 1}</span>
                    <div className="ranking__bar">
                      <div className="ranking__label"><strong>{product.name}</strong><span>{formatInteger(product.total_out)} uds.</span></div>
                      <div className="progress"><div className="progress__fill" style={{ width: `${Math.min(100, (Number(product.total_out) / Number(top[0].total_out || 1)) * 100)}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState message="No hay salidas registradas" />}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
