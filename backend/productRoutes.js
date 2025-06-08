const express = require('express');
const { db } = require('./database'); // Assuming db is exported from database.js

const router = express.Router();

// Helper function for promise-based DB all query
function dbQueryAll(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Database queryAll error:", err.message, "SQL:", query, "Params:", params);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// --- GET All Products Endpoint (Public) ---
router.get('/', async (req, res) => {
    const sql = 'SELECT id, name, description, price, image_url, category FROM Products ORDER BY name ASC';
    try {
        const products = await dbQueryAll(sql);
        res.status(200).json(products); // products will be an empty array if no products found
    } catch (error) {
        console.error("Error fetching all products:", error);
        res.status(500).json({ message: 'Failed to fetch products.', error: error.message });
    }
});

module.exports = router;
