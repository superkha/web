-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    affiliate_id TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    referred_by_user_id INTEGER DEFAULT NULL,
    FOREIGN KEY (referred_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
);

-- Products Table
CREATE TABLE IF NOT EXISTS Products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    price REAL NOT NULL,
    image_url TEXT NULL DEFAULT NULL,
    category TEXT DEFAULT 'Uncategorized',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS Orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount REAL NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
);

-- OrderItems Table
CREATE TABLE IF NOT EXISTS OrderItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(id)
);

-- AffiliateReferrals Table
CREATE TABLE IF NOT EXISTS AffiliateReferrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referring_user_id INTEGER NOT NULL,
    referred_user_id INTEGER,
    referred_order_id INTEGER UNIQUE,
    commission_rate_at_referral REAL NOT NULL,
    commission_earned REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referring_user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_user_id) REFERENCES Users(id) ON DELETE SET NULL,
    FOREIGN KEY (referred_order_id) REFERENCES Orders(id) ON DELETE SET NULL
);

-- AffiliateSettings Table
CREATE TABLE IF NOT EXISTS AffiliateSettings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_name TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL
);