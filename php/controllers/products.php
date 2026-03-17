<?php
// ============================================================
// STREETWISE PH - Products Controller
// ============================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

startSecureSession();
$action = $_POST['action'] ?? $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':      getProducts();     break;
    case 'single':    getSingleProduct(); break;
    case 'featured':  getFeatured();     break;
    case 'add':       addProduct();      break;
    case 'update':    updateProduct();   break;
    case 'delete':    deleteProduct();   break;
    case 'categories': getCategories();  break;
    default: echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

function getProducts(): void {
    $db       = getDB();
    $category = $_GET['category'] ?? '';
    $search   = $_GET['search'] ?? '';
    $page     = max(1, (int)($_GET['page'] ?? 1));
    $limit    = 12;
    $offset   = ($page - 1) * $limit;
    $where    = ["p.is_active = 1"];
    $params   = [];
    if ($category) { $where[] = "c.slug = ?"; $params[] = $category; }
    if ($search)   { $where[] = "p.name LIKE ?"; $params[] = "%$search%"; }
    $whereSQL = implode(' AND ', $where);
    $sql = "SELECT p.*, c.name AS category_name,
            (SELECT SUM(quantity) FROM inventory WHERE product_id = p.id) AS total_stock
            FROM products p LEFT JOIN categories c ON p.category_id = c.id
            WHERE $whereSQL ORDER BY p.created_at DESC LIMIT $limit OFFSET $offset";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();
    foreach ($products as &$p) {
        $p['sizes']  = json_decode($p['sizes'] ?? '[]');
        $p['colors'] = json_decode($p['colors'] ?? '[]');
    }
    $countStmt = $db->prepare("SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE $whereSQL");
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();
    echo json_encode(['success' => true, 'products' => $products, 'total' => $total, 'pages' => ceil($total / $limit)]);
}

function getSingleProduct(): void {
    $id   = $_GET['id'] ?? 0;
    $slug = $_GET['slug'] ?? '';
    $db   = getDB();
    $sql  = "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = 1 AND ";
    $sql .= $id ? "p.id = ?" : "p.slug = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$id ?: $slug]);
    $product = $stmt->fetch();
    if (!$product) { echo json_encode(['success' => false, 'message' => 'Product not found.']); return; }
    $product['sizes']  = json_decode($product['sizes'] ?? '[]');
    $product['colors'] = json_decode($product['colors'] ?? '[]');
    // Get inventory
    $inv = $db->prepare("SELECT size, color, quantity FROM inventory WHERE product_id = ?");
    $inv->execute([$product['id']]);
    $product['inventory'] = $inv->fetchAll();
    // Get comments
    $com = $db->prepare("SELECT c.*, u.full_name FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.product_id = ? AND c.is_approved = 1 ORDER BY c.created_at DESC");
    $com->execute([$product['id']]);
    $product['comments'] = $com->fetchAll();
    echo json_encode(['success' => true, 'product' => $product]);
}

function getFeatured(): void {
    $db   = getDB();
    $stmt = $db->prepare("SELECT p.*, c.name AS category_name, (SELECT SUM(quantity) FROM inventory WHERE product_id = p.id) AS total_stock FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_featured = 1 AND p.is_active = 1 LIMIT 8");
    $stmt->execute();
    $products = $stmt->fetchAll();
    foreach ($products as &$p) {
        $p['sizes']  = json_decode($p['sizes'] ?? '[]');
        $p['colors'] = json_decode($p['colors'] ?? '[]');
    }
    echo json_encode(['success' => true, 'products' => $products]);
}

function addProduct(): void {
    requireOwner();
    $fields = ['name','description','price','category_id'];
    foreach ($fields as $f) if (empty($_POST[$f])) { echo json_encode(['success'=>false,'message'=>"$f is required."]); return; }
    $db   = getDB();
    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', trim($_POST['name']))) . '-' . time();
    $stmt = $db->prepare("INSERT INTO products (category_id,name,slug,description,price,original_price,sizes,colors,is_featured,is_active) VALUES (?,?,?,?,?,?,?,?,?,1)");
    $stmt->execute([
        $_POST['category_id'], $_POST['name'], $slug, $_POST['description'],
        $_POST['price'], $_POST['original_price'] ?? null,
        json_encode(explode(',', $_POST['sizes'] ?? '')),
        json_encode(explode(',', $_POST['colors'] ?? '')),
        isset($_POST['is_featured']) ? 1 : 0
    ]);
    $productId = $db->lastInsertId();
    echo json_encode(['success' => true, 'product_id' => $productId, 'message' => 'Product added.']);
}

function updateProduct(): void {
    requireOwner();
    $id = $_POST['id'] ?? 0;
    if (!$id) { echo json_encode(['success' => false, 'message' => 'Product ID required.']); return; }
    $db   = getDB();
    $stmt = $db->prepare("UPDATE products SET category_id=?,name=?,description=?,price=?,original_price=?,sizes=?,colors=?,is_featured=?,is_active=? WHERE id=?");
    $stmt->execute([
        $_POST['category_id'], $_POST['name'], $_POST['description'],
        $_POST['price'], $_POST['original_price'] ?? null,
        json_encode(explode(',', $_POST['sizes'] ?? '')),
        json_encode(explode(',', $_POST['colors'] ?? '')),
        isset($_POST['is_featured']) ? 1 : 0,
        isset($_POST['is_active']) ? 1 : 0,
        $id
    ]);
    echo json_encode(['success' => true, 'message' => 'Product updated.']);
}

function deleteProduct(): void {
    requireOwner();
    $id = $_POST['id'] ?? 0;
    if (!$id) { echo json_encode(['success' => false, 'message' => 'Product ID required.']); return; }
    $db   = getDB();
    $stmt = $db->prepare("UPDATE products SET is_active = 0 WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Product removed.']);
}

function getCategories(): void {
    $db   = getDB();
    $stmt = $db->query("SELECT * FROM categories ORDER BY name");
    echo json_encode(['success' => true, 'categories' => $stmt->fetchAll()]);
}
