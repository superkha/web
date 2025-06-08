const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// DEVELOPMENT NOTE:
// If you modify `schema.sql` (e.g., add columns, change table structures),
// you may need to delete the existing `ecommerce_affiliate.db` file in this directory.
// The `initializeDB` function, as written, will then recreate the database with the
// new schema. This is a common practice in SQLite-based development.
// For production, more sophisticated migration strategies would be used.
// (This comment is a duplicate of the one already present, ensuring it's noted)

// DEV_NOTE: If you modify schema.sql (e.g., add columns), delete the existing ecommerce_affiliate.db file to ensure it's recreated with the new schema on next server start.

const DATABASE_FILE = path.join(__dirname, 'ecommerce_affiliate.db');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

// Create a new database instance
// The database is created on disk at the specified path.
const db = new sqlite3.Database(DATABASE_FILE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        // Consider whether to throw the error or exit if the DB is essential
        // throw err; 
    } else {
        console.log(`Connected to the SQLite database at ${DATABASE_FILE}`);
    }
});

// Function to initialize the database by executing schema
function initializeDB() {
    db.serialize(() => {
        console.log('Initializing database schema...');
        try {
            const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
            console.log("---------- SCHEMA.SQL AS READ BY Node.js fs.readFileSync ----------");
            console.log(schema);
            console.log("--------------------------------------------------------------------");
            // Split schema into individual statements (assuming statements are separated by ';')
            // and filter out empty statements that might result from splitting.
            const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);

            statements.forEach(statement => {
                if (statement) { // Ensure statement is not empty
                    db.run(statement, (err) => {
                        if (err) {
                            console.error(`Error executing statement: ${statement}`, err.message);
                        } else {
                            // console.log(`Executed statement successfully: ${statement.substring(0, 60)}...`); // Log snippet
                        }
                    });
                }
            });
            console.log('Database schema initialization attempted.');
            seedProducts(); // Call after schema setup
            seedAffiliateSettings(); // Call after schema setup
        } catch (readErr) {
            console.error('Failed to read schema file:', readErr.message);
        }
    });
}

// Function to seed products if the table is empty
function seedProducts() {
    db.get("SELECT COUNT(*) as count FROM Products", (err, row) => {
        if (err) {
            console.error("Error counting products:", err.message);
            return;
        }
        if (row && row.count === 0) {
            console.log("No products found, seeding initial products...");
            const productsToSeed = [
                { name: 'Ebook - Web Development', description: 'A comprehensive guide to modern web development.', price: 19.99, image_url: 'https://dummyimage.com/150x150/3B82F6/fff.png&amp;text=Ebook', category: 'Books' },
                { name: 'Software License - XYZ Tool', description: '1 year license for XYZ utility.', price: 49.99, image_url: 'https://dummyimage.com/150x150/3B82F6/fff.png&amp;text=Software', category: 'Software' },
                { name: 'Online Course - JavaScript Basics', description: 'Learn JS from scratch.', price: 29.99, image_url: 'https://dummyimage.com/150x150/3B82F6/fff.png&amp;text=Course', category: 'Courses' }
            ];

            const stmt = db.prepare("INSERT INTO Products (name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?)");
            productsToSeed.forEach(product => {
                stmt.run(product.name, product.description, product.price, product.image_url, product.category, (err) => {
                    if (err) {
                        // Handle unique constraint error gracefully for name, though it shouldn't happen if table is empty
                        if (err.message.includes('UNIQUE constraint failed: Products.name')) {
                            console.warn(`Product "${product.name}" already exists or another product has the same name.`);
                        } else {
                            console.error(`Error inserting product ${product.name}:`, err.message);
                        }
                    } else {
                        console.log(`Inserted product: ${product.name}`);
                    }
                });
            });
            stmt.finalize((err) => {
                if (err) console.error("Error finalizing product seeding statement:", err.message);
                else console.log("Product seeding process completed.");
            });
        } else {
            console.log("Products table already contains data or error occurred during count.");
        }
    });
}

module.exports = {
    db,
    initializeDB
};

// Function to seed affiliate settings if the table is empty
function seedAffiliateSettings() {
    db.get("SELECT COUNT(*) as count FROM AffiliateSettings WHERE setting_name = 'default_commission_rate'", (err, row) => {
        if (err) {
            console.error("Error counting affiliate settings:", err.message);
            return;
        }
        if (row && row.count === 0) {
            console.log("No default commission rate found, seeding...");
            const stmt = db.prepare("INSERT INTO AffiliateSettings (setting_name, setting_value) VALUES (?, ?)");
            stmt.run('default_commission_rate', '0.10', (err) => { // 10% commission rate
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                         console.warn("Default commission rate already exists.");
                    } else {
                        console.error("Error inserting default commission rate:", err.message);
                    }
                } else {
                    console.log("Inserted default commission rate: 0.10");
                }
            });
            stmt.finalize((err) => {
                if (err) console.error("Error finalizing affiliate settings seeding statement:", err.message);
            });
        } else {
            console.log("Default commission rate already exists or error occurred.");
        }
    });
}
