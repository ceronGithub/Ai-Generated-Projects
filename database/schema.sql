-- ============================================================
-- STREETWISE PH - Apparel Store Database Schema
-- Compatible with: PlanetScale (MySQL 8.0)
-- ============================================================

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'guest') DEFAULT 'guest',
  full_name VARCHAR(150),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  image_url VARCHAR(255),
  images JSON,
  sizes JSON,
  colors JSON,
  is_featured TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  size VARCHAR(20),
  color VARCHAR(50),
  quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  user_id INT,
  guest_name VARCHAR(150),
  guest_email VARCHAR(150),
  guest_phone VARCHAR(20),
  shipping_address TEXT NOT NULL,
  payment_method ENUM('cash_on_delivery') DEFAULT 'cash_on_delivery',
  payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
  order_status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) DEFAULT 0.00,
  discount DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  product_image VARCHAR(255),
  size VARCHAR(20),
  color VARCHAR(50),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id INT,
  product_id INT NOT NULL,
  size VARCHAR(20),
  color VARCHAR(50),
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  guest_name VARCHAR(100),
  product_id INT,
  content TEXT NOT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  is_approved TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200),
  subtitle VARCHAR(300),
  cta_text VARCHAR(100),
  cta_link VARCHAR(255),
  image_url VARCHAR(255),
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SEED DATA
-- Default Owner (password: Admin@1234)
INSERT INTO users (username, email, password_hash, role, full_name) VALUES
('owner', 'owner@streetwiseph.com', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'Store Owner');

INSERT INTO categories (name, slug, description) VALUES
('Men', 'men', 'Men apparel collection'),
('Women', 'women', 'Women apparel collection'),
('Unisex', 'unisex', 'Unisex styles for everyone'),
('Accessories', 'accessories', 'Caps, bags, and more');

INSERT INTO products (category_id, name, slug, description, price, original_price, image_url, sizes, colors, is_featured) VALUES
(3, 'Obsidian Oversized Tee', 'obsidian-oversized-tee', 'Premium heavyweight cotton oversized tee. 320gsm drop-shoulder cut.', 1299.00, 1599.00, 'assets/images/product1.jpg', '["XS","S","M","L","XL","XXL"]', '["Black","White","Charcoal"]', 1),
(1, 'Noir Cargo Pants', 'noir-cargo-pants', 'Tactical cargo pants with utility pockets. Relaxed fit.', 2499.00, 2999.00, 'assets/images/product2.jpg', '["28","30","32","34","36"]', '["Black","Olive","Grey"]', 1),
(2, 'Velvet Crop Hoodie', 'velvet-crop-hoodie', 'Cropped hoodie in ultra-soft fleece. Relaxed silhouette.', 1899.00, NULL, 'assets/images/product3.jpg', '["XS","S","M","L"]', '["Black","Dusty Rose","Cream"]', 1),
(3, 'Phantom Zip Jacket', 'phantom-zip-jacket', 'Water-resistant shell jacket. Minimal branding, maximum style.', 3299.00, 3999.00, 'assets/images/product4.jpg', '["S","M","L","XL","XXL"]', '["Black","Midnight Blue"]', 0),
(4, 'Shadow Cap', 'shadow-cap', 'Structured 6-panel cap with embroidered logo.', 799.00, NULL, 'assets/images/product5.jpg', '["One Size"]', '["Black","White","Tan"]', 0),
(2, 'Silk Touch Slip Dress', 'silk-touch-slip-dress', 'Satin-finish slip dress. Elegant and minimal.', 1699.00, 2199.00, 'assets/images/product6.jpg', '["XS","S","M","L"]', '["Black","Champagne","Ivory"]', 1);

INSERT INTO inventory (product_id, size, color, quantity) VALUES
(1,'S','Black',25),(1,'M','Black',30),(1,'L','Black',20),(1,'XL','Black',15),
(1,'S','White',20),(1,'M','White',25),(1,'L','White',18),
(2,'30','Black',15),(2,'32','Black',20),(2,'34','Black',12),(2,'30','Olive',10),(2,'32','Olive',15),
(3,'S','Black',18),(3,'M','Black',22),(3,'L','Black',10),(3,'S','Dusty Rose',15),(3,'M','Dusty Rose',12),
(4,'M','Black',8),(4,'L','Black',10),(4,'XL','Black',6),
(5,'One Size','Black',40),(5,'One Size','White',35),(5,'One Size','Tan',20),
(6,'S','Black',12),(6,'M','Black',14),(6,'S','Champagne',8),(6,'M','Champagne',10);

INSERT INTO banners (title, subtitle, cta_text, cta_link, sort_order) VALUES
('Wear The Dark.', 'New collection — luxury streetwear crafted for those who move in silence.', 'Shop Now', 'shop.html', 1),
('Defined By Edge.', 'Oversized fits. Premium fabrics. Zero compromise.', 'Explore Collection', 'shop.html', 2),
('The Phantom Drop.', 'Limited pieces. Permanent style.', 'Get Yours', 'shop.html', 3);
