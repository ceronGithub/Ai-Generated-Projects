<?php
// ============================================================
// STREETWISE PH - Export Controller (PDF, PPTX, DOCX, XLSX)
// ============================================================
// Requires: composer require tecnickcom/tcpdf phpoffice/phpspreadsheet phpoffice/phpword phpoffice/phppresentation
// Run: composer install  in project root
// ============================================================
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../../vendor/autoload.php';

startSecureSession();
requireOwner();

$format = $_GET['format'] ?? 'pdf';
$from   = $_GET['from']   ?? date('Y-m-01');
$to     = $_GET['to']     ?? date('Y-m-d');

$db = getDB();
// Gather data
$overviewStmt = $db->prepare("SELECT COUNT(*) AS total_orders, SUM(total) AS total_revenue, AVG(total) AS avg_order FROM orders WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?");
$overviewStmt->execute([$from, $to]);
$overview = $overviewStmt->fetch();

$byDateStmt = $db->prepare("SELECT DATE(created_at) AS date, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY date");
$byDateStmt->execute([$from, $to]);
$byDate = $byDateStmt->fetchAll();

$byProductStmt = $db->prepare("SELECT oi.product_name, SUM(oi.quantity) AS units_sold, SUM(oi.total_price) AS revenue FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.order_status != 'cancelled' AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 10");
$byProductStmt->execute([$from, $to]);
$byProduct = $byProductStmt->fetchAll();

switch ($format) {
    case 'pdf':   exportPDF($overview, $byDate, $byProduct, $from, $to);   break;
    case 'excel': exportExcel($overview, $byDate, $byProduct, $from, $to); break;
    case 'word':  exportWord($overview, $byDate, $byProduct, $from, $to);  break;
    case 'ppt':   exportPPT($overview, $byDate, $byProduct, $from, $to);   break;
    default: die('Invalid format.');
}

function exportPDF($overview, $byDate, $byProduct, $from, $to): void {
    $pdf = new TCPDF('L', 'mm', 'A4', true, 'UTF-8');
    $pdf->SetCreator('Streetwise PH'); $pdf->SetAuthor('Streetwise PH Store'); $pdf->SetTitle('Sales Report');
    $pdf->AddPage();
    $pdf->SetFont('helvetica', 'B', 20);
    $pdf->Cell(0, 10, 'STREETWISE PH — Sales Report', 0, 1, 'C');
    $pdf->SetFont('helvetica', '', 11);
    $pdf->Cell(0, 8, "Period: $from to $to", 0, 1, 'C');
    $pdf->Ln(5);
    $pdf->SetFont('helvetica', 'B', 13);
    $pdf->Cell(0, 8, 'Overview', 0, 1);
    $pdf->SetFont('helvetica', '', 11);
    $pdf->Cell(0, 7, "Total Orders: " . ($overview['total_orders'] ?? 0), 0, 1);
    $pdf->Cell(0, 7, "Total Revenue: ₱" . number_format($overview['total_revenue'] ?? 0, 2), 0, 1);
    $pdf->Cell(0, 7, "Average Order Value: ₱" . number_format($overview['avg_order'] ?? 0, 2), 0, 1);
    $pdf->Ln(5);
    $pdf->SetFont('helvetica', 'B', 13);
    $pdf->Cell(0, 8, 'Top Products', 0, 1);
    $pdf->SetFont('helvetica', 'B', 10);
    $pdf->Cell(120, 7, 'Product', 1); $pdf->Cell(40, 7, 'Units Sold', 1); $pdf->Cell(50, 7, 'Revenue', 1); $pdf->Ln();
    $pdf->SetFont('helvetica', '', 10);
    foreach ($byProduct as $p) {
        $pdf->Cell(120, 7, $p['product_name'], 1);
        $pdf->Cell(40, 7, $p['units_sold'], 1);
        $pdf->Cell(50, 7, '₱' . number_format($p['revenue'], 2), 1);
        $pdf->Ln();
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="streetwise_ph-sales-' . $from . '.pdf"');
    echo $pdf->Output('', 'S');
}

function exportExcel($overview, $byDate, $byProduct, $from, $to): void {
    $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
    $sheet       = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Sales Report');
    $sheet->setCellValue('A1', 'STREETWISE PH Sales Report');
    $sheet->setCellValue('A2', "Period: $from to $to");
    $sheet->setCellValue('A4', 'Overview');
    $sheet->setCellValue('A5', 'Total Orders');    $sheet->setCellValue('B5', $overview['total_orders'] ?? 0);
    $sheet->setCellValue('A6', 'Total Revenue');   $sheet->setCellValue('B6', $overview['total_revenue'] ?? 0);
    $sheet->setCellValue('A7', 'Avg Order Value'); $sheet->setCellValue('B7', $overview['avg_order'] ?? 0);
    $sheet->setCellValue('A9', 'Top Products');
    $sheet->setCellValue('A10', 'Product'); $sheet->setCellValue('B10', 'Units Sold'); $sheet->setCellValue('C10', 'Revenue');
    $row = 11;
    foreach ($byProduct as $p) {
        $sheet->setCellValue("A$row", $p['product_name']);
        $sheet->setCellValue("B$row", $p['units_sold']);
        $sheet->setCellValue("C$row", $p['revenue']);
        $row++;
    }
    $sheet->setCellValue("A$row", 'Daily Sales');
    $row++; $sheet->setCellValue("A$row", 'Date'); $sheet->setCellValue("B$row", 'Orders'); $sheet->setCellValue("C$row", 'Revenue'); $row++;
    foreach ($byDate as $d) {
        $sheet->setCellValue("A$row", $d['date']); $sheet->setCellValue("B$row", $d['orders']); $sheet->setCellValue("C$row", $d['revenue']); $row++;
    }
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="streetwise_ph-sales-' . $from . '.xlsx"');
    $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
    $writer->save('php://output');
}

function exportWord($overview, $byDate, $byProduct, $from, $to): void {
    $phpWord  = new \PhpOffice\PhpWord\PhpWord();
    $section  = $phpWord->addSection();
    $section->addTitle('STREETWISE PH Sales Report', 1);
    $section->addText("Period: $from to $to");
    $section->addTitle('Overview', 2);
    $section->addText('Total Orders: ' . ($overview['total_orders'] ?? 0));
    $section->addText('Total Revenue: ₱' . number_format($overview['total_revenue'] ?? 0, 2));
    $section->addText('Avg Order Value: ₱' . number_format($overview['avg_order'] ?? 0, 2));
    $section->addTitle('Top Products', 2);
    $table = $section->addTable();
    $table->addRow(); $table->addCell(4000)->addText('Product'); $table->addCell(2000)->addText('Units Sold'); $table->addCell(2000)->addText('Revenue');
    foreach ($byProduct as $p) {
        $table->addRow();
        $table->addCell(4000)->addText($p['product_name']);
        $table->addCell(2000)->addText($p['units_sold']);
        $table->addCell(2000)->addText('₱' . number_format($p['revenue'], 2));
    }
    header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    header('Content-Disposition: attachment; filename="streetwise_ph-sales-' . $from . '.docx"');
    $writer = \PhpOffice\PhpWord\IOFactory::createWriter($phpWord, 'Word2007');
    $writer->save('php://output');
}

function exportPPT($overview, $byDate, $byProduct, $from, $to): void {
    $prs    = new \PhpOffice\PhpPresentation\PhpPresentation();
    $slide1 = $prs->getActiveSlide();
    $title  = $slide1->createTitleShape();
    $title->setHeight(60)->setWidth(600)->setOffsetX(60)->setOffsetY(100);
    $title->getActiveParagraph()->createTextRun('STREETWISE PH Sales Report')->getFont()->setBold(true)->setSize(28);
    $sub = $slide1->createRichTextShape()->setHeight(40)->setWidth(600)->setOffsetX(60)->setOffsetY(180);
    $sub->getActiveParagraph()->createTextRun("Period: $from to $to");
    $slide2 = $prs->createSlide();
    $titleShape = $slide2->createTitleShape()->setHeight(50)->setWidth(600)->setOffsetX(60)->setOffsetY(40);
    $titleShape->getActiveParagraph()->createTextRun('Sales Overview')->getFont()->setBold(true)->setSize(22);
    $body = $slide2->createRichTextShape()->setHeight(300)->setWidth(600)->setOffsetX(60)->setOffsetY(120);
    $body->getActiveParagraph()->createTextRun('Total Orders: ' . ($overview['total_orders'] ?? 0))->getFont()->setSize(16);
    $body->createParagraph()->createTextRun('Total Revenue: ₱' . number_format($overview['total_revenue'] ?? 0, 2))->getFont()->setSize(16);
    $body->createParagraph()->createTextRun('Avg Order Value: ₱' . number_format($overview['avg_order'] ?? 0, 2))->getFont()->setSize(16);
    header('Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation');
    header('Content-Disposition: attachment; filename="streetwise_ph-sales-' . $from . '.pptx"');
    $writer = \PhpOffice\PhpPresentation\IOFactory::createWriter($prs, 'PowerPoint2007');
    $writer->save('php://output');
}
