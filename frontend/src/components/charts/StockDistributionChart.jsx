import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = {
  NORMAL: '#16A34A',
  BAJO: '#EAB308',
  CRITICO: '#F97316',
  AGOTADO: '#DC2626',
};

const LABELS = {
  NORMAL: 'Normal', BAJO: 'Bajo', CRITICO: 'Crítico', AGOTADO: 'Agotado',
};

export default function StockDistributionChart({ distribution = [] }) {
  const data = distribution
    .filter((item) => item.total > 0)
    .map((item) => ({ ...item, name: LABELS[item.level] || item.level }));

  if (!data.length) {
    return <p className="chart-empty">No hay productos activos para mostrar.</p>;
  }

  return (
    <div className="chart-container chart-container--pie">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={3}>
            {data.map((entry) => <Cell key={entry.level} fill={COLORS[entry.level]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E3EAF1', fontSize: 12 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
