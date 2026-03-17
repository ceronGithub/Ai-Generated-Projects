<?php
// ============================================================
// STREETWISE PH - Sales Analysis Controller (Owner Only)
// ============================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

startSecureSession();
requireOwner();
$action = $_GET['action'] ?? 'overview';

switch ($action) {
    case 'overview':     getSalesOverview();     break;
    case 'by_date':      getSalesByDate();        break;
    case 'by_product':   getSalesByProduct();     break;
    case 'by_category':  getSalesByCategory();    break;
    case 'recent_orders':getRecentOrders();       break;
    default: echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

function getSalesOverview(): void {
    $db   = getDB();
    $from = $_GET['from'] ?? date('Y-m-01');
    $to   = $_GET['to']   ?? date('Y-m-d');
    $stmt = $db->prepare("SELECT COUNT(*) AS total_orders, SUM(total) AS total_revenue, AVG(total) AS avg_order_value FROM orders WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?");
    $stmt->execute([$from, $to]);
    $overview = $stmt->fetch();
    // Previous period comparison
    $days  = (strtotime($to) - strtotime($from)) / 86400;
    $prevTo   = date('Y-m-d', strtotime($from) - 86400);
    $prevFrom = date('Y-m-d', strtotime($prevTo) - ($days * 86400));
    $stmt->execute([$prevFrom, $prevTo]);
    $prev = $stmt->fetch();
    // Today stats
    $todayStmt = $db->prepare("SELECT COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE DATE(created_at) = CURDATE() AND order_status != 'cancelled'");
    $todayStmt->execute();
    $today = $todayStmt->fetch();
    // Pending orders
    $pendStmt = $db->query("SELECT COUNT(*) FROM orders WHERE order_status = 'pending'");
    $pending  = $pendStmt->fetchColumn();
    echo json_encode([
        'success'  => true,
        'period'   => ['from' => $from, 'to' => $to],
        'overview' => $overview,
        'previous' => $prev,
        'today'    => $today,
        'pending_orders' => $pending
    ]);
}

function getSalesByDate(): void {
    $db   = getDB();
    $from = $_GET['from'] ?? date('Y-m-01');
    $to   = $_GET['to']   ?? date('Y-m-d');
    $stmt = $db->prepare("SELECT DATE(created_at) AS date, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY date ASC");
    $stmt->execute([$from, $to]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
}

function getSalesByProduct(): void {
    $db   = getDB();
    $from = $_GET['from'] ?? date('Y-m-01');
    $to   = $_GET['to']   ?? date('Y-m-d');
    $stmt = $db->prepare("SELECT oi.product_name, SUM(oi.quantity) AS units_sold, SUM(oi.total_price) AS revenue, oi.product_image FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.order_status != 'cancelled' AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY oi.product_id, oi.product_name ORDER BY revenue DESC LIMIT 10");
    $stmt->execute([$from, $to]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
}

function getSalesByCategory(): void {
    $db   = getDB();
    $from = $_GET['from'] ?? date('Y-m-01');
    $to   = $_GET['to']   ?? date('Y-m-d');
    $stmt = $db->prepare("SELECT c.name AS category, SUM(oi.quantity) AS units_sold, SUM(oi.total_price) AS revenue FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id LEFT JOIN categories c ON p.category_id = c.id WHERE o.order_status != 'cancelled' AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY c.id, c.name ORDER BY revenue DESC");
    $stmt->execute([$from, $to]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
}

function getRecentOrders(): void {
    $db   = getDB();
    $stmt = $db->query("SELECT id, order_number, guest_name, total, order_status, created_at FROM orders ORDER BY created_at DESC LIMIT 10");
    echo json_encode(['success' => true, 'orders' => $stmt->fetchAll()]);
}
