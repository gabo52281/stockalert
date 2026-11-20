import EmptyState from './EmptyState.jsx';
import Loading from './Loading.jsx';

export default function Table({ columns, rows, loading = false, emptyMessage = 'No hay registros para mostrar', onRowClick }) {
  if (loading) return <Loading label="Cargando información…" />;
  if (!rows?.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'align-right' : ''}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id || index}
              className={onRowClick ? 'clickable' : ''}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'align-right' : ''}>
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
