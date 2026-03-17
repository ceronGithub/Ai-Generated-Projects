<?php
// ============================================================
// STREETWISE PH - Comments Controller
// ============================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

startSecureSession();
$action = $_POST['action'] ?? $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':   listComments();  break;
    case 'add':    addComment();    break;
    case 'delete': deleteComment(); break;
    default: echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

function listComments(): void {
    $productId = $_GET['product_id'] ?? 0;
    $db = getDB();
    $sql = "SELECT c.*, u.full_name AS user_name FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.is_approved = 1";
    $params = [];
    if ($productId) { $sql .= " AND c.product_id = ?"; $params[] = $productId; }
    $sql .= " ORDER BY c.created_at DESC LIMIT 50";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    echo json_encode(['success' => true, 'comments' => $stmt->fetchAll()]);
}

function addComment(): void {
    $db        = getDB();
    $userId    = $_SESSION['user_id'] ?? null;
    $content   = trim($_POST['content'] ?? '');
    $guestName = trim($_POST['guest_name'] ?? '');
    $productId = $_POST['product_id'] ?? null;
    $rating    = (int)($_POST['rating'] ?? 5);
    if (!$content) { echo json_encode(['success' => false, 'message' => 'Comment cannot be empty.']); return; }
    if (!$userId && !$guestName) { echo json_encode(['success' => false, 'message' => 'Name required for guests.']); return; }
    $stmt = $db->prepare("INSERT INTO comments (user_id, guest_name, product_id, content, rating) VALUES (?,?,?,?,?)");
    $stmt->execute([$userId, $userId ? null : $guestName, $productId ?: null, $content, min(5, max(1, $rating))]);
    echo json_encode(['success' => true, 'message' => 'Comment posted.']);
}

function deleteComment(): void {
    requireOwner();
    $id   = $_POST['id'] ?? 0;
    $db   = getDB();
    $stmt = $db->prepare("DELETE FROM comments WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Comment deleted.']);
}
