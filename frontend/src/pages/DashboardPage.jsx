import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight, ArrowUpRight, BellRing, Boxes, CircleAlert, Coins,
  Package, Plus, TrendingDown,
} from 'lucide-react';
import { dashboardApi } from '../api/endpoints.js';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Loading from '../components/ui/Loading.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import MovementsChart from '../components/charts/MovementsChart.jsx';
import StockDistributionChart from '../components/charts/StockDistributionChart.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

function StatCard({ icon: Icon, label, value, hint, tone = 'blue' }) {
  return (
    <Card className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon"><Icon size={21} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useApi(() => dashboardApi.get(days).then((response) => response.data), [days]);

  if (loading) return <><PageHeader title="Panel principal" /><Loading label="Cargando indicadores…" /></>;
  if (error || !data) return <EmptyState message="No fue posible cargar el panel" detail="Verifique la conexión con la API." />;

  const { summary, alerts, series, distribution, recentMovements, topProducts, attentionProducts } = data;

  return (
    <>
      <PageHeader
        title="Panel principal"
        description={`Vista general del inventario · últimos ${days} días`}
        actions={(
          <div className="period-switch">
            {[7, 30, 90].map((option) => (
              <button key={option} type="button" className={days === option ? 'active' : ''} onClick={() => setDays(option)}>
                {option} días
              </button>
            ))}
          </div>
        )}
      />

      <div className="stats-grid">
        <StatCard icon={Boxes} label="Referencias activas" value={formatNumber(summary.active_products)} tone="blue" />
        <StatCard icon={Package} label="Unidades disponibles" value={formatNumber(summary.total_units)} tone="cyan" />
        <StatCard
          icon={CircleAlert}
          label="Productos en atención"
          value={formatNumber(alerts.attention)}
          hint={`${alerts.critical} críticos · ${alerts.out_of_stock} agotados`}
          tone="orange"
        />
        <StatCard icon={Coins} label="Valor del inventario" value={formatCurrency(summary.inventory_value)} hint="Valorado al precio de compra" tone="green" />
      </div>

      <div className="quick-access">
        <span>Accesos rápidos</span>
        <Link to="/movimientos"><Plus size={16} /> Registrar movimiento</Link>
        <Link to="/alertas"><BellRing size={16} /> Ver alertas</Link>
        <Link to="/reportes"><TrendingDown size={16} /> Generar reporte</Link>
      </div>

      <div className="grid-2 dashboard-grid">
        <Card>
          <CardHeader title="Entradas y salidas" subtitle="Unidades por día en el período seleccionado" />
          <CardBody><MovementsChart data={series} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Distribución del inventario" subtitle="Productos activos por estado" />
          <CardBody><StockDistributionChart distribution={distribution} /></CardBody>
        </Card>
      </div>

      <div className="grid-2 dashboard-grid">
        <Card>
          <CardHeader
            title="Productos que necesitan atención"
            subtitle="Prioridad: agotados, críticos y bajos"
            action={<Link to="/alertas" className="text-link">Ver todos</Link>}
          />
          <CardBody>
            {alerts.attention === 0 ? (
              <EmptyState message="No hay productos en riesgo" detail="Todas las existencias están por encima del umbral preventivo." />
            ) : (
              <div className="mini-list">
                {attentionProducts.map((product) => (
                  <div key={product.id} className="mini-list__row">
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.code}</span>
                    </div>
                    <StatusPill value={product.alert_level} />
                    <small>{product.coverage_days} días</small>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Movimientos recientes" subtitle="Últimas operaciones registradas" />
          <CardBody>
            {recentMovements.length === 0 ? (
              <EmptyState message="Aún no hay movimientos" />
            ) : (
              <div className="mini-list">
                {recentMovements.map((movement) => (
                  <div key={movement.id} className="mini-list__row">
                    <div className={movement.type === 'IN' ? 'movement-icon movement-icon--in' : 'movement-icon movement-icon--out'}>
                      {movement.type === 'IN' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>
                    <div>
                      <strong>{movement.product_name}</strong>
                      <span>{formatDateTime(movement.movement_date)} · {movement.user_name}</span>
                    </div>
                    <StatusPill value={movement.type} />
                    <small>{formatNumber(movement.quantity)} uds.</small>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid-2 dashboard-grid">
        <Card>
          <CardHeader title="Productos con mayores salidas" subtitle={`Unidades retiradas en ${days} días`} />
          <CardBody>
            {topProducts.length === 0 ? (
              <EmptyState message="Sin salidas registradas" />
            ) : (
              <div className="ranking">
                {topProducts.map((product, index) => (
                  <div key={product.id} className="ranking__row">
                    <span className="ranking__index">{index + 1}</span>
                    <div className="ranking__bar">
                      <div className="ranking__label"><strong>{product.name}</strong><span>{formatNumber(product.total_out)} uds.</span></div>
                      <div className="progress"><div className="progress__fill" style={{ width: `${Math.min(100, (Number(product.total_out) / Number(topProducts[0].total_out || 1)) * 100)}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Resumen de cobertura" subtitle="Estimación con datos históricos (no predicción)" />
          <CardBody>
            <div className="coverage-summary">
              <div>
                <span>Cobertura global estimada</span>
                <strong>{summary.coverage_days === null ? 'Sin datos suficientes' : `${formatNumber(summary.coverage_days)} días`}</strong>
                <small>Salida diaria promedio: {formatNumber(summary.avg_daily_out)} unidades</small>
              </div>
              <div className="coverage-summary__figures">
                <div><span>Entradas</span><strong>{formatNumber(summary.entries)}</strong></div>
                <div><span>Salidas</span><strong>{formatNumber(summary.exits)}</strong></div>
                <div><span>Valor venta</span><strong>{formatCurrency(summary.inventory_sale_value)}</strong></div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
