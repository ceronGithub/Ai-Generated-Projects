<?php
// ============================================================
// STREETWISE PH - Cart Controller
// ============================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

startSecureSession();
$action    = $_POST['action'] ?? $_GET['action'] ?? 'get';
$sessionId = getSessionId();
$userId    = $_SESSION['user_id'] ?? null;

switch ($action) {
    case 'get':     getCart();    break;
    case 'add':     addToCart();  break;
    case 'update':  updateCart(); break;
    case 'remove':  removeItem(); break;
    case 'clear':   clearCart();  break;
    case 'count':   getCount();   break;
    default: echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

function getCart(): void {
    global $sessionId, $userId;
    $db   = getDB();
    $sql  = "SELECT c.*, p.name, p.price, p.image_url, p.slug,
             (SELECT quantity FROM inventory WHERE product_id = c.product_id AND size = c.size AND color = c.color LIMIT 1) AS stock
             FROM cart c JOIN products p ON c.product_id = p.id
             WHERE c.session_id = ?";
    $params = [$sessionId];
    if ($userId) { $sql .= " OR c.user_id = ?"; $params[] = $userId; }
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $items    = $stmt->fetchAll();
    $subtotal = array_sum(array_map(fn($i) => $i['price'] * $i['quantity'], $items));
    echo json_encode(['success' => true, 'items' => $items, 'subtotal' => $subtotal, 'count' => count($items)]);
}

function addToCart(): void {
    global $sessionId, $userId;
    $productId = (int)($_POST['product_id'] ?? 0);
    $size      = trim($_POST['size'] ?? '');
    $color     = trim($_POST['color'] ?? '');
    $qty       = max(1, (int)($_POST['quantity'] ?? 1));
    if (!$productId) { echo json_encode(['success' => false, 'message' => 'Product required.']); return; }
    $db = getDB();
    // Check stock
    $inv = $db->prepare("SELECT quantity FROM inventory WHERE product_id = ? AND size = ? AND color = ?");
    $inv->execute([$productId, $size, $color]);
    $stock = $inv->fetchColumn();
    if ($stock !== false && $stock < $qty) {
        echo json_encode(['success' => false, 'message' => "Only $stock items in stock."]); return;
    }
    // Check existing cart item
    $exists = $db->prepare("SELECT id, quantity FROM cart WHERE session_id = ? AND product_id = ? AND size = ? AND color = ?");
    $exists->execute([$sessionId, $productId, $size, $color]);
    $row = $exists->fetch();
    if ($row) {
        $newQty = $row['quantity'] + $qty;
        $upd    = $db->prepare("UPDATE cart SET quantity = ? WHERE id = ?");
        $upd->execute([$newQty, $row['id']]);
    } else {
        $ins = $db->prepare("INSERT INTO cart (session_id, user_id, product_id, size, color, quantity) VALUES (?,?,?,?,?,?)");
        $ins->execute([$sessionId, $userId, $productId, $size, $color, $qty]);
    }
    echo json_encode(['success' => true, 'message' => 'Added to cart.']);
}

function updateCart(): void {
    global $sessionId;
    $cartId = (int)($_POST['cart_id'] ?? 0);
    $qty    = max(1, (int)($_POST['quantity'] ?? 1));
    $db     = getDB();
    $stmt   = $db->prepare("UPDATE cart SET quantity = ? WHERE id = ? AND session_id = ?");
    $stmt->execute([$qty, $cartId, $sessionId]);
    echo json_encode(['success' => true, 'message' => 'Cart updated.']);
}

function removeItem(): void {
    global $sessionId;
    $cartId = (int)($_POST['cart_id'] ?? 0);
    $db     = getDB();
    $stmt   = $db->prepare("DELETE FROM cart WHERE id = ? AND session_id = ?");
    $stmt->execute([$cartId, $sessionId]);
    echo json_encode(['success' => true, 'message' => 'Item removed.']);
}

function clearCart(): void {
    global $sessionId;
    $db   = getDB();
    $stmt = $db->prepare("DELETE FROM cart WHERE session_id = ?");
    $stmt->execute([$sessionId]);
    echo json_encode(['success' => true, 'message' => 'Cart cleared.']);
}

function getCount(): void {
    global $sessionId;
    $db   = getDB();
    $stmt = $db->prepare("SELECT SUM(quantity) FROM cart WHERE session_id = ?");
    $stmt->execute([$sessionId]);
    echo json_encode(['success' => true, 'count' => (int)$stmt->fetchColumn()]);
}
