const express = require('express');
const { db } = require('./database'); 
const { verifyToken } = require('./authRoutes'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // For creating directory if it doesn't exist

const router = express.Router();

const BACKEND_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000'; 

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
const productUploadsDir = path.join(uploadsDir, 'products');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(productUploadsDir)) {
    fs.mkdirSync(productUploadsDir);
}


// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, productUploadsDir); // Use the absolute path
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Multer file filter
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        // Pass an error to be caught by a general error handler or multer's error handler
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 * 5 } // 5MB limit
});

// Configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'; // Placeholder for admin email

// --- verifyAdmin Middleware ---
const verifyAdmin = (req, res, next) => {
    // verifyToken should have already populated req.user
    if (!req.user) {
        // This case should ideally be caught by verifyToken if it's always applied first
        return res.status(401).json({ message: 'Access denied. No user context.' });
    }

    if (req.user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }
    
    // User is admin, proceed to the next middleware or route handler
    next();
};

// Helper function to query all rows from the database (can be moved to a shared utils file if used elsewhere)
function dbQueryAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error("Database queryAll error:", err.message, "SQL:", sql, "Params:", params);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Helper function for promise-based DB run (for INSERT, UPDATE, DELETE)
function dbRun(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) { // Use function() to access 'this'
            if (err) {
                console.error("Database run error:", err.message, "SQL:", query, "Params:", params);
                reject(err);
            } else {
                // For INSERT, this.lastID is the ID of the new row
                // For UPDATE/DELETE, this.changes is the number of rows affected
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

// --- GET All Affiliate Referrals Endpoint (Admin) ---
router.get('/all-referrals', verifyToken, verifyAdmin, async (req, res) => {
    const sql = `
        SELECT 
            ar.id as referral_id,
            ar.commission_earned,
            ar.commission_rate_at_referral,
            ar.status as commission_status,
            ar.created_at as commission_date,
            o.id as order_id,
            o.order_date,
            o.total_amount as order_total_amount,
            AffiliateUser.name as affiliate_name,
            AffiliateUser.email as affiliate_email,
            ReferredCustomer.name as customer_name,
            ReferredCustomer.email as customer_email
        FROM AffiliateReferrals ar
        JOIN Users AffiliateUser ON ar.referring_user_id = AffiliateUser.id
        JOIN Users ReferredCustomer ON ar.referred_user_id = ReferredCustomer.id
        JOIN Orders o ON ar.referred_order_id = o.id
        ORDER BY ar.created_at DESC
    `;

    try {
        const referrals = await dbQueryAll(sql);
        res.status(200).json(referrals);
    } catch (error) {
        console.error("Error fetching all affiliate referrals:", error);
        res.status(500).json({ message: 'Failed to fetch all affiliate referrals.', error: error.message });
    }
});

// --- PUT Update Referral Status Endpoint (Admin) ---
router.put('/referrals/:referralId/status', verifyToken, verifyAdmin, async (req, res) => {
    const { referralId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'approved', 'paid', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ 
            message: 'Invalid status provided.',
            validStatuses: validStatuses 
        });
    }

    if (!referralId || isNaN(parseInt(referralId))) {
        return res.status(400).json({ message: 'Invalid referral ID provided.' });
    }

    const sql = 'UPDATE AffiliateReferrals SET status = ? WHERE id = ?';

    db.run(sql, [status, referralId], function(err) { // Use function() to get this.changes
        if (err) {
            console.error("Error updating referral status:", err.message);
            return res.status(500).json({ message: 'Failed to update referral status.', error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: `Referral with ID ${referralId} not found.` });
        }
        res.status(200).json({ message: `Referral ID ${referralId} status updated to ${status}.` });
    });
});

// --- POST Add New Product Endpoint (Admin) ---
// Added upload.single('productImage') middleware
router.post('/products', verifyToken, verifyAdmin, function(req, res, next) {
    // Use multer's error handling by passing 'next' to upload.single
    upload.single('productImage')(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            console.error('[Admin Add Product] MulterError:', err);
            return res.status(400).json({ message: 'File upload error: ' + err.message });
        } else if (err) {
            // An unknown error occurred when uploading (e.g., from fileFilter).
            console.error('[Admin Add Product] FileFilter/Unknown Upload Error:', err.message);
            return res.status(400).json({ message: err.message || 'File type not allowed or unknown upload error.' });
        }
        // Everything went fine with the upload, proceed to route handler logic
        next();
    });
}, async (req, res) => {
    console.log('[Admin BE] POST /api/admin/products route hit.'); 
    console.log('[Admin BE] req.body received:', JSON.stringify(req.body, null, 2)); 
    console.log('[Admin BE] req.file received:', req.file);
    
    // req.file is the `productImage` file
    // req.body will hold the text fields, if it were a multipart form
    const { name, description, price, category } = req.body; // image_url text field is removed

    // --- Validate Input ---
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'Product name is required and must be a non-empty string.' });
    }
    if (price === undefined || price === null) {
        return res.status(400).json({ message: 'Product price is required.' });
    }
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ message: 'Product price must be a positive number.' });
    }

    // Use default values from schema if optional fields are not provided or are empty strings
    // The schema defaults are:
    // image_url TEXT DEFAULT 'https://dummyimage.com/150x150/404040/eeeeee.png&text=No+Image',
    // category TEXT DEFAULT 'Uncategorized',

    let imageUrlForDb = null; 
    if (req.file) {
        imageUrlForDb = BACKEND_BASE_URL + '/uploads/products/' + req.file.filename;
        console.log('[Admin Add Product] File uploaded:', req.file);
        console.log('[Admin Add Product] Image URL for DB:', imageUrlForDb);
    } else {
        console.log('[Admin Add Product] No file uploaded, using default (NULL) for image_url.');
        // Schema default will be used if imageUrlForDb remains null
    }
    
    const finalCategory = (typeof category === 'string' && category.trim() !== '') ? category.trim() : null;
    const finalDescription = (typeof description === 'string' && description.trim() !== '') ? description.trim() : null;

    const sql = 'INSERT INTO Products (name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?)';
    
    try {
        const result = await dbRun(sql, [name.trim(), finalDescription, numericPrice, imageUrlForDb, finalCategory]);
        const newProductId = result.lastID;

        // Optionally, retrieve and return the newly created product
        db.get('SELECT * FROM Products WHERE id = ?', [newProductId], (err, newProduct) => {
            if (err) {
                console.error("Error fetching newly created product:", err.message);
                // If fetching fails, still return success for creation but log the fetch error
                return res.status(201).json({ 
                    message: 'Product added successfully, but failed to fetch the created product details.', 
                    productId: newProductId 
                });
            }
            if (!newProduct) {
                 return res.status(201).json({ 
                    message: 'Product added successfully, but could not find it immediately after creation.', 
                    productId: newProductId 
                });
            }
            res.status(201).json({ message: 'Product added successfully.', product: newProduct });
        });

    } catch (error) {
        console.error("Error adding new product:", error.message);
        if (error.message.includes('UNIQUE constraint failed: Products.name')) {
            return res.status(409).json({ message: 'Product name already exists.' });
        }
        res.status(500).json({ message: 'Failed to add product.', error: error.message });
    }
});


module.exports = router;
