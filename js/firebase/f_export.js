// ============================================================
// STREETWISE PH — export.js | PDF, Excel, Word, PPT Export
// Uses: jsPDF, SheetJS (xlsx), docx.js, PptxGenJS
// All loaded via CDN — no server needed
// ============================================================

// ── Format currency ────────────────────────────────────────
const peso = n => "₱" + parseFloat(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

// ── Export PDF ─────────────────────────────────────────────
export async function exportPDF(overview, byDate, byProduct, from, to) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape", "mm", "a4");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("STREETWISE PH — Sales Report", 148, 20, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(`Period: ${from} to ${to}`, 148, 30, { align: "center" });
  pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
  pdf.text("Overview", 20, 45);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
  pdf.text(`Total Orders: ${overview.totalOrders}`, 20, 55);
  pdf.text(`Total Revenue: ${peso(overview.totalRevenue)}`, 20, 63);
  pdf.text(`Average Order Value: ${peso(overview.avgOrder)}`, 20, 71);
  pdf.text(`Today's Revenue: ${peso(overview.todayRevenue)}`, 20, 79);
  pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
  pdf.text("Top Products", 20, 95);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(10);
  pdf.text("Product", 20, 105); pdf.text("Units Sold", 160, 105); pdf.text("Revenue", 220, 105);
  pdf.line(20, 108, 277, 108);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  let y = 115;
  byProduct.forEach(p => {
    if (y > 180) { pdf.addPage(); y = 20; }
    pdf.text(p.productName.substring(0, 40), 20, y);
    pdf.text(String(p.unitsSold), 160, y);
    pdf.text(peso(p.revenue), 220, y);
    y += 8;
  });
  pdf.save(`streetwise-ph-sales-${from}.pdf`);
}

// ── Export Excel ───────────────────────────────────────────
export function exportExcel(overview, byDate, byProduct, from, to) {
  const XLSX = window.XLSX;
  const wb   = XLSX.utils.book_new();
  // Overview sheet
  const overviewData = [
    ["STREETWISE PH Sales Report"],
    [`Period: ${from} to ${to}`],
    [],
    ["Metric", "Value"],
    ["Total Orders",   overview.totalOrders],
    ["Total Revenue",  overview.totalRevenue],
    ["Avg Order",      overview.avgOrder],
    ["Today Revenue",  overview.todayRevenue],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewData), "Overview");
  // Daily sales sheet
  const dailyData = [["Date", "Orders", "Revenue"], ...byDate.map(d => [d.date, d.orders, d.revenue])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), "Daily Sales");
  // Top products sheet
  const productData = [["Product", "Units Sold", "Revenue"], ...byProduct.map(p => [p.productName, p.unitsSold, p.revenue])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productData), "Top Products");
  XLSX.writeFile(wb, `streetwise-ph-sales-${from}.xlsx`);
}

// ── Export Word ────────────────────────────────────────────
export function exportWord(overview, byDate, byProduct, from, to) {
  const content = `
STREETWISE PH — Sales Report
Period: ${from} to ${to}

OVERVIEW
--------
Total Orders:  ${overview.totalOrders}
Total Revenue: ${peso(overview.totalRevenue)}
Avg Order:     ${peso(overview.avgOrder)}
Today Revenue: ${peso(overview.todayRevenue)}

TOP PRODUCTS
------------
${byProduct.map(p => `${p.productName.padEnd(40)} Units: ${p.unitsSold}  Revenue: ${peso(p.revenue)}`).join("\n")}

DAILY SALES
-----------
${byDate.map(d => `${d.date}  Orders: ${d.orders}  Revenue: ${peso(d.revenue)}`).join("\n")}
  `.trim();
  const blob = new Blob([content], { type: "application/msword" });
  const link = document.createElement("a");
  link.href  = URL.createObjectURL(blob);
  link.download = `streetwise-ph-sales-${from}.doc`;
  link.click();
}

// ── Export PowerPoint ──────────────────────────────────────
export function exportPPT(overview, byDate, byProduct, from, to) {
  const pptx = new window.PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  // Slide 1 — Title
  const s1 = pptx.addSlide();
  s1.background = { color: "0a0a0a" };
  s1.addText("STREETWISE PH", { x: 1, y: 1.5, w: 8, h: 1.2, fontSize: 36, bold: true, color: "c9a96e", align: "center" });
  s1.addText("Sales Report", { x: 1, y: 2.8, w: 8, h: 0.8, fontSize: 24, color: "f0ece4", align: "center" });
  s1.addText(`Period: ${from} to ${to}`, { x: 1, y: 3.7, w: 8, h: 0.5, fontSize: 14, color: "a09888", align: "center" });
  // Slide 2 — Overview
  const s2 = pptx.addSlide();
  s2.background = { color: "0a0a0a" };
  s2.addText("Sales Overview", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 24, bold: true, color: "c9a96e" });
  const rows = [
    [{ text: "Metric", options: { bold: true, color: "c9a96e" } }, { text: "Value", options: { bold: true, color: "c9a96e" } }],
    ["Total Orders", String(overview.totalOrders)],
    ["Total Revenue", peso(overview.totalRevenue)],
    ["Avg Order Value", peso(overview.avgOrder)],
    ["Today's Revenue", peso(overview.todayRevenue)],
  ];
  s2.addTable(rows, { x: 0.5, y: 1.2, w: 9, color: "f0ece4", fontSize: 14, border: { type: "solid", color: "2a2520" }, fill: { color: "161616" } });
  // Slide 3 — Top Products
  const s3 = pptx.addSlide();
  s3.background = { color: "0a0a0a" };
  s3.addText("Top Products", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 24, bold: true, color: "c9a96e" });
  const pRows = [
    [{ text: "Product", options: { bold: true, color: "c9a96e" } }, { text: "Units", options: { bold: true, color: "c9a96e" } }, { text: "Revenue", options: { bold: true, color: "c9a96e" } }],
    ...byProduct.map(p => [p.productName, String(p.unitsSold), peso(p.revenue)])
  ];
  s3.addTable(pRows, { x: 0.5, y: 1.2, w: 9, color: "f0ece4", fontSize: 12, border: { type: "solid", color: "2a2520" }, fill: { color: "161616" } });
  pptx.writeFile({ fileName: `streetwise-ph-sales-${from}.pptx` });
}
