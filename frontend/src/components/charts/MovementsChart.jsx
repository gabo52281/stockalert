import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatDate, formatNumber } from '../../utils/format.js';

export default function MovementsChart({ data = [] }) {
  if (!data.length) {
    return <p className="chart-empty">No hay movimientos registrados en el período seleccionado.</p>;
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7EDF3" />
          <XAxis
            dataKey="day"
            tickFormatter={(value) => formatDate(value).replace(/ de \w+/, '').replace(',', '')}
            tick={{ fontSize: 11, fill: '#7A8A99' }}
            minTickGap={22}
          />
          <YAxis tick={{ fontSize: 11, fill: '#7A8A99' }} allowDecimals={false} />
          <Tooltip
            formatter={(value, name) => [formatNumber(value), name === 'inputs' ? 'Entradas' : 'Salidas']}
            labelFormatter={(value) => formatDate(value)}
            contentStyle={{ borderRadius: 10, border: '1px solid #E3EAF1', fontSize: 12 }}
          />
          <Legend formatter={(value) => (value === 'inputs' ? 'Entradas' : 'Salidas')} />
          <Bar dataKey="inputs" name="Entradas" fill="#2563EB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outputs" name="Salidas" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
