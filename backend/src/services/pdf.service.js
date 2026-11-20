'use strict';

const PDFDocument = require('pdfkit');
const { formatReportValue } = require('../utils/format');

const BLUE = '#12304F';
const LIGHT = '#EEF3F8';
const GRAY = '#5A6B7B';

function formatValue(value, column) {
  if (value === null || value === undefined) return '—';
  return formatReportValue(value, column);
}

function buildPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const availableWidth = doc.page.width - 72;
    const columns = report.columns;
    const weights = columns.map((column) => Math.max(60, Math.min(150, column.label.length * 7 + 30)));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((weight) => (weight / totalWeight) * availableWidth);

    function drawHeader() {
      doc.rect(0, 0, doc.page.width, 64).fill(BLUE);
      doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
        .text('STOCKALERT', 36, 14);
      doc.fontSize(10).font('Helvetica')
        .text(report.title, 36, 38);
      doc.fontSize(8).text(
        `Generado: ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`,
        availableWidth + 36, 20, { align: 'right', width: 240 },
      );

      const activeFilters = Object.entries(report.filters || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}: ${formatValue(value)}`)
        .join('  |  ');
      doc.moveDown(0.6).fillColor(GRAY).fontSize(8)
        .text(activeFilters || 'Sin filtros aplicados', 36, 72, { width: availableWidth });

      doc.y = 88;
    }

    function drawTableHeader() {
      let x = 36;
      doc.rect(36, doc.y, availableWidth, 20).fill(LIGHT);
      doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(7.5);
      columns.forEach((column, index) => {
        doc.text(column.label, x + 3, doc.y + 6, { width: widths[index] - 6, ellipsis: true });
        x += widths[index];
      });
      doc.y += 20;
      doc.fillColor('#000000').font('Helvetica').fontSize(7.5);
    }

    drawHeader();
    drawTableHeader();

    let rowIndex = 0;
    for (const row of report.rows) {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        drawHeader();
        drawTableHeader();
      }
      let x = 36;
      const y = doc.y;
      if (rowIndex % 2 === 1) {
        doc.rect(36, y, availableWidth, 16).fill('#F8FAFC');
        doc.fillColor('#000000');
      }
      columns.forEach((column, index) => {
        doc.text(formatValue(row[column.key], column), x + 3, y + 4, {
          width: widths[index] - 6, height: 14, ellipsis: true,
        });
        x += widths[index];
      });
      doc.y = y + 16;
      rowIndex += 1;
    }

    if (report.rows.length === 0) {
      doc.fillColor(GRAY).fontSize(10)
        .text('No hay datos para los filtros seleccionados.', 36, doc.y + 12);
    }

    const range = doc.bufferedPageRange();
    for (let page = 0; page < range.count; page += 1) {
      doc.switchToPage(range.start + page);
      doc.fillColor(GRAY).fontSize(7)
        .text(`STOCKALERT · Página ${page + 1} de ${range.count}`, 36, doc.page.height - 28,
          { width: availableWidth, align: 'center' });
    }

    doc.end();
  });
}

module.exports = { buildPdf };
