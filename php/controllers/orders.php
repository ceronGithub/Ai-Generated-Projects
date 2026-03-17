<?php
// ============================================================
// STREETWISE PH - Orders Controller (Checkout + Order Management)
// ============================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

startSecureSession();
$action = $_POST['action'] ?? $_GET['action'] ?? 'list';

switch ($action) {
    case 'checkout':      placeOrder();      break;
    case 'list':          listOrders();      break;
    case 'single':        getSingleOrder();  break;
    case 'update_status': updateStatus();    break;
    default: echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

function placeOrder(): void {
    $db        = getDB();
    $sessionId = getSessionId();
    $userId    = $_SESSION['user_id'] ?? null;
    // Get cart items
    $stmt = $db->prepare("SELECT c.*, p.name, p.price, p.image_url FROM cart c JOIN products p ON c.product_id = p.id WHERE c.session_id = ?");
    $stmt->execute([$sessionId]);
    $cartItems = $stmt->fetchAll();
    if (empty($cartItems)) { echo json_encode(['success' => false, 'message' => 'Cart is empty.']); return; }
    // Validate required fields
    $required = ['shipping_address', 'guest_name', 'guest_email', 'guest_phone'];
    foreach ($required as $f) if (empty($_POST[$f])) { echo json_encode(['success'=>false,'message'=>"$f is required."]); return; }
    $subtotal = array_sum(array_map(fn($i) => $i['price'] * $i['quantity'], $cartItems));
    $shipping = 150.00;
    $total    = $subtotal + $shipping;
    $orderNum = 'TLX-' . strtoupper(uniqid());
    $db->beginTransaction();
    try {
        $stmt = $db->prepare("INSERT INTO orders (order_number,user_id,guest_name,guest_email,guest_phone,shipping_address,payment_method,subtotal,shipping_fee,total,notes) VALUES (?,?,?,?,?,?,'cash_on_delivery',?,?,?,?)");
        $stmt->execute([$orderNum,$userId,$_POST['guest_name'],$_POST['guest_email'],$_POST['guest_phone'],$_POST['shipping_address'],$subtotal,$shipping,$total,$_POST['notes']??'']);
        $orderId = $db->lastInsertId();
        $itemStmt = $db->prepare("INSERT INTO order_items (order_id,product_id,product_name,product_image,size,color,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?,?,?,?)");
        $invStmt  = $db->prepare("UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND size = ? AND color = ?");
        foreach ($cartItems as $item) {
            $itemStmt->execute([$orderId,$item['product_id'],$item['name'],$item['image_url'],$item['size'],$item['color'],$item['quantity'],$item['price'],$item['price']*$item['quantity']]);
            $invStmt->execute([$item['quantity'],$item['product_id'],$item['size'],$item['color']]);
        }
        $del = $db->prepare("DELETE FROM cart WHERE session_id = ?");
        $del->execute([$sessionId]);
        $db->commit();
        echo json_encode(['success'=>true,'order_number'=>$orderNum,'total'=>$total,'message'=>'Order placed successfully!']);
    } catch (Exception $e) {
        $db->rollBack();
        echo json_encode(['success'=>false,'message'=>'Order failed. Please try again.']);
    }
}

function listOrders(): void {
    requireOwner();
    $db     = getDB();
    $status = $_GET['status'] ?? '';
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = 20;
    $offset = ($page - 1) * $limit;
    $where  = $status ? "WHERE o.order_status = ?" : "";
    $params = $status ? [$status] : [];
    $stmt   = $db->prepare("SELECT o.*, COUNT(oi.id) AS item_count FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id $where GROUP BY o.id ORDER BY o.created_at DESC LIMIT $limit OFFSET $offset");
    $stmt->execute($params);
    echo json_encode(['success' => true, 'orders' => $stmt->fetchAll()]);
}

function getSingleOrder(): void {
    $id  = $_GET['id'] ?? 0;
    $num = $_GET['order_number'] ?? '';
    $db  = getDB();
    $sql = "SELECT * FROM orders WHERE " . ($id ? "id = ?" : "order_number = ?");
    $stmt = $db->prepare($sql);
    $stmt->execute([$id ?: $num]);
    $order = $stmt->fetch();
    if (!$order) { echo json_encode(['success' => false, 'message' => 'Order not found.']); return; }
    $items = $db->prepare("SELECT * FROM order_items WHERE order_id = ?");
    $items->execute([$order['id']]);
    $order['items'] = $items->fetchAll();
    echo json_encode(['success' => true, 'order' => $order]);
}

function updateStatus(): void {
    requireOwner();
    $id     = $_POST['id'] ?? 0;
    $status = $_POST['status'] ?? '';
    $valid  = ['pending','confirmed','processing','shipped','delivered','cancelled'];
    if (!in_array($status, $valid)) { echo json_encode(['success'=>false,'message'=>'Invalid status.']); return; }
    $db   = getDB();
    $stmt = $db->prepare("UPDATE orders SET order_status = ? WHERE id = ?");
    $stmt->execute([$status, $id]);
    echo json_encode(['success' => true, 'message' => 'Order status updated.']);
}
