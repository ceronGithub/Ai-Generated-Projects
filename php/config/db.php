<?php
// ============================================================
//  STREETWISE PH — PlanetScale Database Connection
//  php/config/db.php
// ============================================================

define('DB_HOST', 'aws.connect.psdb.cloud');   // Your PlanetScale host
define('DB_NAME', 'streetwise_ph');                 // Your database name
define('DB_USER', 'your_username');             // Your PlanetScale username
define('DB_PASS', 'your_password');             // Your PlanetScale password
define('DB_CHARSET', 'utf8mb4');

// PlanetScale requires SSL
$ssl_cert = __DIR__ . '/cacert.pem'; // Download from PlanetScale dashboard

function getDBConnection(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET . ";port=3306";

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_SSL_CA       => __DIR__ . '/cacert.pem',
        PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        http_response_code(500);
        die(json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]));
    }

    return $pdo;
}

// Alias for short usage
function db(): PDO {
    return getDBConnection();
}
