'use strict';

const PDFDocument = require('pdfkit');
const {
  formatDateValue,
  formatFilterValue,
  formatReportValue,
  isIntegerColumn,
  isMoneyColumn,
} = require('../utils/format');

const BLUE = '#12304F';
const BLUE_SOFT = '#1D4E79';
const LIGHT = '#EEF3F8';
const BORDER = '#D8E2EC';
const ROW_ALT = '#F8FAFC';
const GRAY = '#5A6B7B';
const WHITE = '#FFFFFF';
const MARGIN = 32;

const FILTER_LABELS = {
  from: 'Desde',
  to: 'Hasta',
  productId: 'Producto',
  categoryId: 'Categoría',
  supplierId: 'Proveedor',
  userId: 'Usuario',
  type: 'Tipo',
  status: 'Estado',
};

const FILTER_VALUES = {
  IN: 'Entradas',
  OUT: 'Salidas',
  NORMAL: 'Normal',
  BAJO: 'Stock bajo',
  CRITICO: 'Crítico',
  AGOTADO: 'Agotado',
  active: 'Activos',
  inactive: 'Inactivos',
  CALCULABLE: 'Calculable',
  INSUFICIENTE: 'Historial insuficiente',
  NO_CALCULABLE: 'Sin cálculo',
};

const COLUMN_WIDTHS = {
  movement_date: 68,
  date: 68,
  type: 44,
  code: 66,
  product_code: 68,
  name: 140,
  product_name: 132,
  category_name: 94,
  supplier_name: 92,
  user_name: 76,
  quantity: 54,
  min_stock: 52,
  preventive_threshold: 66,
  stock_before: 58,
  stock_after: 58,
  total_out: 62,
  movements: 58,
  alert_level: 58,
  coverage_status: 74,
  avg_daily_out: 66,
  coverage_days: 66,
  reason: 82,
  notes: 84,
  purchase_price: 76,
  sale_price: 76,
  inventory_value: 80,
  inventory_sale_value: 80,
};

function cleanText(value) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNumericColumn(column) {
  return isMoneyColumn(column)
    || isIntegerColumn(column)
    || /d[ií]as|prom\.|total|valor|cantidad|existencia/i.test(column?.label || '');
}

function cellText(value, column) {
  const formatted = value === null || value === undefined
    ? '—'
    : formatReportValue(value, column);
  return cleanText(formatted) || '—';
}

function truncateToWidth(doc, text, maxWidth, font, fontSize) {
  doc.font(font).fontSize(fontSize);
  const source = cleanText(text);
  if (!source || doc.widthOfString(source) <= maxWidth) return source;

  let result = source;
  while (result && doc.widthOfString(`${result}…`) > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function wrapLines(doc, text, maxWidth, font, fontSize, maxLines = Infinity) {
  doc.font(font).fontSize(fontSize);

  const source = cleanText(text);
  if (!source) return ['—'];

  const lines = [];
  for (const paragraph of source.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      if (doc.widthOfString(word) > maxWidth) {
        if (current) {
          lines.push(current);
          current = '';
        }
        let chunk = '';
        for (const char of word) {
          if (doc.widthOfString(chunk + char) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
        continue;
      }

      const candidate = current ? `${current} ${word}` : word;
      if (current && doc.widthOfString(candidate) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }

  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  let last = clipped[maxLines - 1] || '';
  while (last && doc.widthOfString(`${last}…`) > maxWidth) last = last.slice(0, -1);
  clipped[maxLines - 1] = `${last}…`;
  return clipped;
}

function buildWidths(columns, availableWidth) {
  const preferred = columns.map((column) => COLUMN_WIDTHS[column.key]
    || (isMoneyColumn(column) ? 78 : isNumericColumn(column) ? 60 : 92));
  const total = preferred.reduce((sum, value) => sum + value, 0);
  const scale = availableWidth / total;

  const widths = preferred.map((value) => Math.max(38, value * scale));
  const adjusted = widths.reduce((sum, value) => sum + value, 0);
  const difference = availableWidth - adjusted;
  if (Math.abs(difference) > 0.5) {
    const textIndexes = columns
      .map((column, index) => (/name|producto|proveedor|categoría|motivo|observaciones/i.test(column.label) ? index : -1))
      .filter((index) => index >= 0);
    const targets = textIndexes.length ? textIndexes : widths.map((_, index) => index);
    const extra = difference / targets.length;
    targets.forEach((index) => { widths[index] = Math.max(38, widths[index] + extra); });
  }
  return widths;
}

function renderDocument(report, knownTotalPages) {
  return new Promise((resolve, reject) => {
    const columns = Array.isArray(report.columns) ? report.columns : [];
    const needsLandscape = columns.length >= 8 || columns.filter(isMoneyColumn).length >= 3;
    const generatedAt = report.generatedAt instanceof Date ? report.generatedAt : new Date();
    const generatedText = formatDateValue(generatedAt, true);
    const headerSize = columns.length >= 9 ? 7.5 : 8;
    const bodySize = columns.length >= 9 ? 7.5 : 8;
    const lineHeight = bodySize + 2.5;

    const doc = new PDFDocument({
      size: 'A4',
      layout: needsLandscape ? 'landscape' : 'portrait',
      margin: MARGIN,
      info: {
        Title: report.title || 'Informe STOCKALERT',
        Author: 'STOCKALERT',
        Subject: 'Informe administrativo de inventario',
        Creator: 'STOCKALERT',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), totalPages: currentPage + 1 }));
    doc.on('error', reject);

    const availableWidth = doc.page.width - MARGIN * 2;
    const pageBottom = doc.page.height - 60;
    const footerY = doc.page.height - 48;
    const widths = buildWidths(columns, availableWidth);
    const offsets = [];
    let currentPage = 0;

    widths.reduce((x, width, index) => {
      offsets[index] = x;
      return x + width;
    }, MARGIN);

    const filterText = Object.entries(report.filters || {})
      .filter(([key, value]) => key !== 'format' && value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        const label = FILTER_LABELS[key] || cleanText(key);
        const resolved = report.filterLabels?.[key];
        const shown = resolved ?? FILTER_VALUES[value]
          ?? (value instanceof Date ? formatDateValue(value, false) : formatFilterValue(value));
        return `${label}: ${cleanText(shown)}`;
      })
      .join('   ·   ');

    function drawFooter() {
      if (!knownTotalPages) return;
      doc.fillColor(GRAY).font('Helvetica').fontSize(7)
        .text(
          `STOCKALERT · ${generatedText} · Página ${currentPage + 1} de ${knownTotalPages}`,
          MARGIN,
          footerY,
          { width: availableWidth, align: 'center', lineBreak: false },
        );
    }

    function drawPageHeader(firstPage) {
      doc.rect(0, 0, doc.page.width, 70).fill(BLUE);

      doc.rect(MARGIN, 15, 24, 24).fill(WHITE);
      doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8.5)
        .text('SA', MARGIN, 23, { width: 24, align: 'center', lineBreak: false });

      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(14)
        .text('STOCKALERT', MARGIN + 34, 14, { lineBreak: false });
      doc.fillColor('#B8CBDD').font('Helvetica').fontSize(8)
        .text('Informes administrativos', MARGIN + 34, 33, { lineBreak: false });

      doc.fillColor('#DCE8F3').font('Helvetica').fontSize(8)
        .text(`Generado: ${generatedText}`, doc.page.width - MARGIN - 310, 16,
          { width: 310, align: 'right', lineBreak: false });
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
        .text(cleanText(report.title), doc.page.width - MARGIN - 310, 34,
          { width: 310, align: 'right', lineBreak: false });

      let y = 70;

      if (filterText) {
        const filterLines = wrapLines(doc, filterText, availableWidth - 20, 'Helvetica', 8, 2);
        const filterHeight = filterLines.length * 11 + 10;
        doc.rect(MARGIN, y + 6, availableWidth, filterHeight).fill('#F4F7FA');
        doc.fillColor(GRAY).font('Helvetica').fontSize(8);
        filterLines.forEach((line, index) => {
          doc.text(line, MARGIN + 10, y + 11 + index * 11,
            { width: availableWidth - 20, lineBreak: false });
        });
        y += filterHeight + 14;
      } else {
        y += 14;
      }

      const summary = firstPage && Array.isArray(report.summary) ? report.summary.slice(0, 5) : [];
      if (summary.length) {
        const gap = 8;
        const boxWidth = (availableWidth - gap * (summary.length - 1)) / summary.length;
        const boxHeight = 46;
        summary.forEach((item, index) => {
          const x = MARGIN + index * (boxWidth + gap);
          doc.rect(x, y, boxWidth, boxHeight).fill(LIGHT);
          doc.rect(x, y, 3, boxHeight).fill(BLUE_SOFT);
          doc.fillColor(GRAY)
            .text(truncateToWidth(doc, item.label, boxWidth - 18, 'Helvetica', 7),
              x + 10, y + 8, { lineBreak: false });
          doc.fillColor(BLUE)
            .text(truncateToWidth(doc, item.value, boxWidth - 18, 'Helvetica-Bold', 12),
              x + 10, y + 23, { lineBreak: false });
        });
        y += boxHeight + 12;
      }

      return y;
    }

    function drawTableHeader(y) {
      const headerLines = columns.map((column, index) => wrapLines(
        doc,
        column.label,
        widths[index] - 8,
        'Helvetica-Bold',
        headerSize,
        2,
      ));
      const maxLines = headerLines.reduce((max, lines) => Math.max(max, lines.length), 1);
      const headerHeight = Math.max(22, maxLines * (headerSize + 2) + 8);

      doc.rect(MARGIN, y, availableWidth, headerHeight).fill(LIGHT);
      doc.moveTo(MARGIN, y + headerHeight).lineTo(MARGIN + availableWidth, y + headerHeight)
        .strokeColor(BORDER).lineWidth(0.6).stroke();

      columns.forEach((column, index) => {
        const align = isNumericColumn(column) ? 'right' : 'left';
        const x = offsets[index] + 4;
        const width = widths[index] - 8;
        doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(headerSize);
        headerLines[index].forEach((line, lineIndex) => {
          doc.text(line, x, y + 4 + lineIndex * (headerSize + 2),
            { width, align, lineBreak: false });
        });
      });

      return y + headerHeight;
    }

    function drawRow(row, rowIndex, y) {
      const lines = columns.map((column, index) => wrapLines(
        doc,
        cellText(row[column.key], column),
        widths[index] - 8,
        'Helvetica',
        bodySize,
      ));
      const maxLines = lines.reduce((max, cell) => Math.max(max, cell.length), 1);
      const rowHeight = Math.max(18, maxLines * lineHeight + 8);

      let cursorY = y;
      if (cursorY + rowHeight > pageBottom) {
        drawFooter();
        doc.addPage();
        currentPage += 1;
        cursorY = drawPageHeader(false);
        cursorY = drawTableHeader(cursorY);
      }

      if (rowIndex % 2 === 1) {
        doc.rect(MARGIN, cursorY, availableWidth, rowHeight).fill(ROW_ALT);
      }

      columns.forEach((column, index) => {
        const align = isNumericColumn(column) ? 'right' : 'left';
        const x = offsets[index] + 4;
        const width = widths[index] - 8;
        doc.fillColor('#1F2D3A').font('Helvetica').fontSize(bodySize);
        lines[index].forEach((line, lineIndex) => {
          doc.text(line, x, cursorY + 4 + lineIndex * lineHeight,
            { width, align, lineBreak: false });
        });
      });

      doc.moveTo(MARGIN, cursorY + rowHeight).lineTo(MARGIN + availableWidth, cursorY + rowHeight)
        .strokeColor(BORDER).lineWidth(0.35).stroke();

      return cursorY + rowHeight;
    }

    let y = drawPageHeader(true);
    y = drawTableHeader(y);

    if (!report.rows?.length) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(10)
        .text('No hay datos para los filtros seleccionados.', MARGIN, y + 16,
          { width: availableWidth, lineBreak: false });
    } else {
      report.rows.forEach((row, index) => {
        y = drawRow(row, index, y);
      });
    }

    drawFooter();
    doc.end();
  });
}

async function buildPdf(report) {
  const firstPass = await renderDocument(report, 0);
  const result = await renderDocument(report, firstPass.totalPages);
  return result.buffer;
}

module.exports = { buildPdf };
