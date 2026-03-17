<?php
// ============================================================
// STREETWISE PH - Session & Auth Helper
// ============================================================

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.cookie_httponly', 1);
        ini_set('session.cookie_secure', 1);
        ini_set('session.use_strict_mode', 1);
        session_start();
    }
}

function isLoggedIn(): bool {
    startSecureSession();
    return isset($_SESSION['user_id']);
}

function isOwner(): bool {
    startSecureSession();
    return isset($_SESSION['role']) && $_SESSION['role'] === 'owner';
}

function requireOwner(): void {
    if (!isOwner()) {
        http_response_code(403);
        die(json_encode(['success' => false, 'message' => 'Access denied. Owner only.']));
    }
}

function getCurrentUser(): array {
    startSecureSession();
    return [
        'id'       => $_SESSION['user_id'] ?? null,
        'username' => $_SESSION['username'] ?? null,
        'role'     => $_SESSION['role'] ?? 'guest',
        'name'     => $_SESSION['full_name'] ?? 'Guest',
    ];
}

function getSessionId(): string {
    startSecureSession();
    return session_id();
}
