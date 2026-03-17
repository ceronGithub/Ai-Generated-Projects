<?php
// ============================================================
// STREETWISE PH - Inventory Controller (Owner Only)
// ============================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

startSecureSession();
requireOwner();
$action = $_POST['action'] ?? $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':   listInventory();  break;
    case 'update': updateStock();    break;
    case 'low':    getLowStock();    break;
    default: echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

function listInventory(): void {
    $db   = getDB();
    $stmt = $db->query("SELECT i.*, p.name AS product_name, p.image_url, c.name AS category FROM inventory i JOIN products p ON i.product_id = p.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = 1 ORDER BY p.name, i.size, i.color");
    $rows = $stmt->fetchAll();
    echo json_encode(['success' => true, 'inventory' => $rows]);
}

function updateStock(): void {
    $id       = (int)($_POST['id'] ?? 0);
    $quantity = (int)($_POST['quantity'] ?? 0);
    $db       = getDB();
    if ($id) {
        $stmt = $db->prepare("UPDATE inventory SET quantity = ? WHERE id = ?");
        $stmt->execute([$quantity, $id]);
    } else {
        $productId = (int)($_POST['product_id'] ?? 0);
        $size      = trim($_POST['size'] ?? '');
        $color     = trim($_POST['color'] ?? '');
        $threshold = (int)($_POST['threshold'] ?? 5);
        $stmt = $db->prepare("INSERT INTO inventory (product_id, size, color, quantity, low_stock_threshold) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity = ?, low_stock_threshold = ?");
        $stmt->execute([$productId, $size, $color, $quantity, $threshold, $quantity, $threshold]);
    }
    echo json_encode(['success' => true, 'message' => 'Inventory updated.']);
}

function getLowStock(): void {
    $db   = getDB();
    $stmt = $db->query("SELECT i.*, p.name AS product_name, p.image_url FROM inventory i JOIN products p ON i.product_id = p.id WHERE i.quantity <= i.low_stock_threshold AND p.is_active = 1 ORDER BY i.quantity ASC");
    echo json_encode(['success' => true, 'items' => $stmt->fetchAll()]);
}
