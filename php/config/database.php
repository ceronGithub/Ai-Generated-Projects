<?php
// ============================================================
// STREETWISE PH - Database Configuration (PlanetScale)
// Replace values with your PlanetScale credentials from:
// app.planetscale.com → Your Database → Connect → PHP (PDO)
// ============================================================

define('DB_HOST', 'aws.connect.psdb.cloud');
define('DB_NAME', 'streetwise_ph');
define('DB_USER', 'your_username_here');
define('DB_PASS', 'your_password_here');
define('DB_SSL',  true);

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    if (DB_SSL) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = __DIR__ . '/cacert.pem';
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
    }
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        http_response_code(500);
        die(json_encode(['success' => false, 'message' => 'Database connection failed.']));
    }
    return $pdo;
}
