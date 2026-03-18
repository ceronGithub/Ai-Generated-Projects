// ============================================================
// STREETWISE PH — Export Module (PDF, Excel, Word, PPT)
// Uses: jsPDF, SheetJS (xlsx), docx.js, PptxGenJS
// All loaded via CDN — no install needed
// ============================================================
import { formatPrice, formatDate } from './helpers.js';

// ── PDF Export ─────────────────────────────────────────────
export function exportPDF(overview, byDate, byProduct, from, to) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  doc.setFont('helvetica','bold');
  doc.setFontSize(20);
  doc.text('STREETWISE PH — Sales Report', 148, 20, { align: 'center' });
  doc.setFont('helvetica','normal');
  doc.setFontSize(11);
  doc.text(`Period: ${from} to ${to}`, 148, 30, { align: 'center' });
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Overview', 20, 45);
  doc.setFont('helvetica','normal'); doc.setFontSize(11);
  doc.text(`Total Orders: ${overview.totalOrders}`,          20, 55);
  doc.text(`Total Revenue: ${formatPrice(overview.totalRevenue)}`, 20, 63);
  doc.text(`Avg Order Value: ${formatPrice(overview.avgOrder)}`,   20, 71);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Top Products', 20, 85);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.autoTable({ startY: 90, head: [['Product','Units Sold','Revenue']], body: byProduct.map(p => [p.productName, p.unitsSold, formatPrice(p.revenue)]), theme: 'grid' });
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Daily Sales', 20, doc.lastAutoTable.finalY + 15);
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 20, head: [['Date','Orders','Revenue']], body: byDate.map(d => [d.date, d.orders, formatPrice(d.revenue)]), theme: 'grid' });
  doc.save(`streetwise-ph-sales-${from}.pdf`);
}

// ── Excel Export ───────────────────────────────────────────
export function exportExcel(overview, byDate, byProduct, from, to) {
  const XLSX = window.XLSX;
  const wb   = XLSX.utils.book_new();
  const overviewData = [
    ['STREETWISE PH Sales Report'],
    [`Period: ${from} to ${to}`],
    [],
    ['Overview'],
    ['Total Orders', overview.totalOrders],
    ['Total Revenue', overview.totalRevenue],
    ['Avg Order Value', overview.avgOrder],
    [],
    ['Top Products'],
    ['Product', 'Units Sold', 'Revenue'],
    ...byProduct.map(p => [p.productName, p.unitsSold, p.revenue]),
    [],
    ['Daily Sales'],
    ['Date', 'Orders', 'Revenue'],
    ...byDate.map(d => [d.date, d.orders, d.revenue])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewData), 'Sales Report');
  XLSX.writeFile(wb, `streetwise-ph-sales-${from}.xlsx`);
}

// ── Word Export ────────────────────────────────────────────
export function exportWord(overview, byDate, byProduct, from, to) {
  const content = `STREETWISE PH — Sales Report\nPeriod: ${from} to ${to}\n\nOVERVIEW\nTotal Orders: ${overview.totalOrders}\nTotal Revenue: ${formatPrice(overview.totalRevenue)}\nAvg Order Value: ${formatPrice(overview.avgOrder)}\n\nTOP PRODUCTS\n${byProduct.map(p=>`${p.productName} | ${p.unitsSold} units | ${formatPrice(p.revenue)}`).join('\n')}\n\nDAILY SALES\n${byDate.map(d=>`${d.date} | ${d.orders} orders | ${formatPrice(d.revenue)}`).join('\n')}`;
  const blob = new Blob([content], { type: 'application/msword' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `streetwise-ph-sales-${from}.doc`;
  a.click();
}

// ── PPT Export ─────────────────────────────────────────────
export function exportPPT(overview, byDate, byProduct, from, to) {
  const pptx = new window.PptxGenJS();
  const s1   = pptx.addSlide();
  s1.addText('STREETWISE PH', { x:1, y:1, w:8, fontSize:36, bold:true, color:'C9A96E', align:'center' });
  s1.addText('Sales Report', { x:1, y:2, w:8, fontSize:24, align:'center' });
  s1.addText(`Period: ${from} to ${to}`, { x:1, y:2.8, w:8, fontSize:14, color:'888888', align:'center' });
  const s2 = pptx.addSlide();
  s2.addText('Sales Overview', { x:.5, y:.3, fontSize:24, bold:true, color:'C9A96E' });
  s2.addText([
    { text:`Total Orders: `, options:{ bold:true } }, { text: String(overview.totalOrders) },
    { text:`\nTotal Revenue: `, options:{ bold:true } }, { text: formatPrice(overview.totalRevenue) },
    { text:`\nAvg Order Value: `, options:{ bold:true } }, { text: formatPrice(overview.avgOrder) },
  ], { x:.5, y:1.2, w:9, fontSize:16 });
  const s3 = pptx.addSlide();
  s3.addText('Top Products', { x:.5, y:.3, fontSize:24, bold:true, color:'C9A96E' });
  s3.addTable(
    [['Product','Units','Revenue'], ...byProduct.slice(0,8).map(p=>[p.productName, String(p.unitsSold), formatPrice(p.revenue)])],
    { x:.5, y:1, w:9, fontSize:11, border:{ type:'solid', color:'333333' } }
  );
  pptx.writeFile({ fileName: `streetwise-ph-sales-${from}.pptx` });
}
