import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ meta, onChange }) {
  if (!meta || meta.total === 0) return null;
  const { page, totalPages, total } = meta;

  return (
    <div className="pagination">
      <span>
        Página <strong>{page}</strong> de <strong>{totalPages}</strong> · {total} registros
      </span>
      <div className="pagination__buttons">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
          <ChevronLeft size={17} />
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Página siguiente">
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
