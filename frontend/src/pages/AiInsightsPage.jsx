import { useState } from 'react';
import {
  AlertTriangle, Bot, BrainCircuit, PackagePlus, Sparkles, TrendingUp,
} from 'lucide-react';
import { aiApi } from '../api/endpoints.js';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatNumber } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Badge from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';

const RISK_TONE = {
  CRITICO: 'danger',
  ALTO: 'danger',
  MEDIO: 'info',
  BAJO: 'neutral',
};

const CONFIDENCE_LABEL = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  sin_historial: 'Sin historial',
};

export default function AiInsightsPage() {
  const [days, setDays] = useState(30);
  const [leadTimeDays, setLeadTimeDays] = useState(14);
  const { data, loading, error, reload } = useApi(
    () => aiApi.insights({ days, leadTimeDays }).then((response) => response.data),
    [days, leadTimeDays],
  );

  const columns = [
    {
      key: 'name',
      label: 'Producto',
      render: (row) => <><strong>{row.name}</strong><small className="cell-sub">{row.code} · {row.category}</small></>,
    },
    { key: 'stock', label: 'Stock', align: 'right', render: (row) => formatNumber(row.stock) },
    {
      key: 'forecastDailyDemand',
      label: 'Demanda/día',
      align: 'right',
      render: (row) => `${formatNumber(row.forecastDailyDemand)} uds.`,
    },
    {
      key: 'daysOfCover',
      label: 'Cobertura',
      align: 'right',
      render: (row) => (row.daysOfCover === null ? '—' : `${formatNumber(row.daysOfCover)} días`),
    },
    { key: 'suggestedQty', label: 'Reponer', align: 'right', render: (row) => <strong>{formatNumber(row.suggestedQty)} uds.</strong> },
    { key: 'reorderPoint', label: 'Punto de pedido', align: 'right', render: (row) => formatNumber(row.reorderPoint) },
    { key: 'risk', label: 'Riesgo', render: (row) => <Badge tone={RISK_TONE[row.risk] || 'neutral'}>{row.risk}</Badge> },
    {
      key: 'forecastConfidence',
      label: 'Confianza',
      render: (row) => <Badge tone="neutral">{CONFIDENCE_LABEL[row.forecastConfidence] || row.forecastConfidence}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Asistente IA de inventario"
        description="Predicción local explicable basada en sus movimientos reales, sin enviar datos a servicios externos."
        actions={(
          <div className="period-switch">
            {[7, 30, 90].map((option) => (
              <button key={option} type="button" className={days === option ? 'active' : ''} onClick={() => setDays(option)}>{option} días</button>
            ))}
          </div>
        )}
      />

      <div className="formula-banner">
        <BrainCircuit size={18} />
        <span>
          Suavizado exponencial con tendencia atenuada, stock de seguridad estadístico y detección de picos atípicos.
          Reposición calculada para {leadTimeDays} días de lead time.
        </span>
        <select
          className="select"
          value={leadTimeDays}
          onChange={(event) => setLeadTimeDays(Number(event.target.value))}
          aria-label="Días de reposición"
        >
          {[7, 14, 21, 30].map((option) => <option key={option} value={option}>{option} días</option>)}
        </select>
      </div>

      {error && (
        <Card className="stat-card stat-card--orange">
          <CardBody>No se pudo generar el análisis. Intente recargar la página.</CardBody>
        </Card>
      )}

      <div className="stats-grid">
        <Card className="stat-card stat-card--blue"><div className="stat-card__icon"><PackagePlus size={21} /></div><div><span>Productos analizados</span><strong>{formatNumber(data?.summary?.analyzedProducts || 0)}</strong></div></Card>
        <Card className="stat-card stat-card--orange"><div className="stat-card__icon"><AlertTriangle size={21} /></div><div><span>Riesgo alto o crítico</span><strong>{formatNumber(data?.summary?.highRiskProducts || 0)}</strong></div></Card>
        <Card className="stat-card stat-card--cyan"><div className="stat-card__icon"><TrendingUp size={21} /></div><div><span>Unidades a reponer</span><strong>{formatNumber(data?.summary?.unitsToReplenish || 0)}</strong></div></Card>
        <Card className="stat-card stat-card--green"><div className="stat-card__icon"><Bot size={21} /></div><div><span>Inversión estimada</span><strong>{formatCurrency(data?.summary?.estimatedPurchaseCost || 0)}</strong></div></Card>
      </div>

      {data && (
        <Card>
          <CardHeader
            title="Resumen del asistente"
            subtitle={data.generatedAt ? new Date(data.generatedAt).toLocaleString('es-CO') : ''}
            action={<Badge tone="info"><Sparkles size={13} /> IA local</Badge>}
          />
          <CardBody>
            <p className="card__subtitle">{data.narrative}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Plan de reposición sugerido"
          subtitle="Ordenado por prioridad, riesgo y urgencia"
          action={<button type="button" className="btn btn--sm btn--ghost" onClick={reload}>Actualizar</button>}
        />
        <CardBody>
          <Table
            columns={columns}
            rows={data?.recommendations}
            loading={loading}
            emptyMessage="El asistente no encontró productos que requieran reposición"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Anomalías detectadas" subtitle="Picos de salida superiores a 2 desviaciones sobre el promedio" />
        <CardBody>
          {data?.anomalies?.length ? (
            <div className="ranking">
              {data.anomalies.map((item) => (
                <div key={item.id} className="ranking__row">
                  <span className="ranking__index"><AlertTriangle size={14} /></span>
                  <div className="ranking__bar">
                    <div className="ranking__label"><strong>{item.name}</strong><span>{formatNumber(item.anomalyScore)} σ · {formatNumber(item.forecastDailyDemand)} uds/día</span></div>
                    <div className="progress"><div className="progress__fill" style={{ width: `${Math.min(100, Math.max(0, item.anomalyScore * 20))}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={loading ? 'Analizando movimientos…' : 'No se detectaron picos atípicos'} />
          )}
        </CardBody>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHeader title="Cómo se calcula" subtitle="Modelo transparente y reproducible" />
          <CardBody>
            <p className="card__subtitle">
              Demanda estimada = suavizado exponencial de las salidas diarias con tendencia atenuada.
              Stock de seguridad = 1,65 × desviación diaria × raíz(días de reposición).
              Punto de pedido = demanda estimada × lead time + stock de seguridad.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Estado de los datos" subtitle={`Ventana analizada: ${days} días`} />
          <CardBody>
            <p className="card__subtitle">
              {data?.summary?.replenishmentProducts || 0} productos requieren reposición y
              {' '}{data?.summary?.anomalyProducts || 0} presentan anomalías. Las alertas originales
              de stock mínimo siguen siendo la fuente oficial del estado de cada producto.
            </p>
            <p className="card__subtitle">Use <StatusPill value="BAJO" /> y <StatusPill value="CRITICO" /> en el módulo Alertas para el control operativo diario.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
