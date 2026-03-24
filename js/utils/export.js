export function exportPDF(overview, byDate, byProduct, from, to) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  // We'll use your existing formatPrice helper instead of cleanPrice
  // to ensure the Peso sign (₱) is preserved.
  const peso = (val) => formatPrice(val);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('STREETWISE PH — Sales Report', 148, 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Period: ${from} to ${to}`, 148, 30, { align: 'center' });

  // --- Overview Section ---
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Overview', 20, 45);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(`Total Orders: ${overview.totalOrders}`, 20, 55);
  doc.text(`Total Revenue: ${peso(overview.totalRevenue)}`, 20, 63);
  doc.text(`Avg Order Value: ${peso(overview.avgOrder)}`, 20, 71);

  // --- Top Products Table ---
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Top Products', 20, 85);
  
  doc.autoTable({
    startY: 90,
    head: [['Product', 'Units Sold', 'Revenue']],
    body: byProduct.map(p => [p.productName, p.unitsSold, peso(p.revenue)]),
    theme: 'grid',
    headStyles: { fillColor: [20, 20, 20] }, // Dark header to match luxury theme
    columnStyles: {
      1: { halign: 'right' }, // Align 'Units Sold' to the right
      2: { halign: 'right' }  // Align 'Revenue' to the right
    }
  });

  // --- Daily Sales Table ---
  const finalY = doc.lastAutoTable.finalY || 150;
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Daily Sales Breakdown', 20, finalY + 15);

  doc.autoTable({
    startY: finalY + 20,
    head: [['Date', 'Orders', 'Revenue']],
    body: byDate.map(d => [d.date, d.count, peso(d.revenue)]),
    theme: 'grid',
    headStyles: { fillColor: [20, 20, 20] },
    columnStyles: {
      1: { halign: 'right' }, // Align 'Orders' to the right
      2: { halign: 'right' }  // Align 'Revenue' to the right
    }
  });

  doc.save(`Streetwise_Report_${from}_to_${to}.pdf`);
}