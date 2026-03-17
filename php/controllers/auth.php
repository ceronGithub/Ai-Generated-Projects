<?php
// ============================================================
// STREETWISE PH - Auth Controller (Login / Logout / Register)
// ============================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

startSecureSession();
$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'login':    handleLogin();    break;
    case 'logout':   handleLogout();   break;
    case 'register': handleRegister(); break;
    case 'status':   handleStatus();   break;
    default: echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

function handleLogin(): void {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    if (!$username || !$password) {
        echo json_encode(['success' => false, 'message' => 'Username and password required.']); return;
    }
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1");
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']); return;
    }
    $_SESSION['user_id']   = $user['id'];
    $_SESSION['username']  = $user['username'];
    $_SESSION['role']      = $user['role'];
    $_SESSION['full_name'] = $user['full_name'];
    echo json_encode([
        'success'  => true,
        'role'     => $user['role'],
        'name'     => $user['full_name'],
        'redirect' => $user['role'] === 'owner' ? 'owner-dashboard.html' : 'index.html'
    ]);
}

function handleLogout(): void {
    session_destroy();
    echo json_encode(['success' => true, 'redirect' => 'index.html']);
}

function handleRegister(): void {
    $username  = trim($_POST['username'] ?? '');
    $email     = trim($_POST['email'] ?? '');
    $password  = $_POST['password'] ?? '';
    $full_name = trim($_POST['full_name'] ?? '');
    if (!$username || !$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'All fields required.']); return;
    }
    if (strlen($password) < 8) {
        echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters.']); return;
    }
    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Username or email already exists.']); return;
    }
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $db->prepare("INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'guest')");
    $stmt->execute([$username, $email, $hash, $full_name]);
    echo json_encode(['success' => true, 'message' => 'Account created. You can now log in.']);
}

function handleStatus(): void {
    echo json_encode([
        'logged_in' => isLoggedIn(),
        'user'      => getCurrentUser()
    ]);
}
