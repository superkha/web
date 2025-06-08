const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('./database'); // Assuming db is exported from database.js

const router = express.Router();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-it'; // Use environment variable in production
const YOUR_WEBSITE_URL = process.env.FRONTEND_URL || 'http://localhost:8080'; // Or your actual frontend URL
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'; // For admin check

// --- Helper function to generate unique affiliate ID ---
function generateAffiliateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// --- Helper function to check if an affiliate ID already exists ---
async function checkAffiliateIdExists(idToCheck) {
    return new Promise((resolve, reject) => {
        db.get('SELECT affiliate_id FROM Users WHERE affiliate_id = ?', [idToCheck], (err, row) => {
            if (err) {
                console.error("Database error checking affiliate ID:", err);
                // Rejecting will stop the affiliate ID generation loop if a DB error occurs during a check.
                // This is generally acceptable as it indicates a larger problem.
                reject(err); 
            } else {
                resolve(row); // row will be undefined if not found, or the row object if found
            }
        });
    });
}

// --- Helper function to find a user by their affiliate ID ---
async function findUserByAffiliateId(affId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id FROM Users WHERE affiliate_id = ?', [affId], (err, row) => {
            if (err) {
                console.error("Database error finding user by affiliate ID:", err);
                reject(err); 
            } else {
                resolve(row); // row will be undefined if not found
            }
        });
    });
}

// --- Middleware to verify JWT ---
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. Token missing.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Add decoded user payload to request object
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ message: 'Invalid token.' });
        }
        console.error("Token verification error:", error);
        return res.status(500).json({ message: 'Failed to authenticate token.' });
    }
};


// --- Registration Endpoint ---
router.post('/register', async (req, res) => {
    const { name, email, password, referringAffiliateId } = req.body; // Added referringAffiliateId

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please provide name, email, and password.' });
    }

    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        // Check if email already exists
        db.get('SELECT email FROM Users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                console.error("Database error (checking email):", err);
                return res.status(500).json({ message: 'Error checking email.', error: err.message });
            }
            if (row) {
                return res.status(409).json({ message: 'Email already registered.' });
            }

            // Hash password
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(password, saltRounds);

            // Generate unique affiliate ID (with a simple retry mechanism for uniqueness, though collisions are rare)
            let affiliate_id;
            let isUnique = false;
            let attempts = 0;
            while (!isUnique && attempts < 5) { // Limit attempts to avoid infinite loops
                affiliate_id = generateAffiliateId();
                // Use the new helper function here
                const existingAffiliate = await checkAffiliateIdExists(affiliate_id);
                if (!existingAffiliate) { // If existingAffiliate is undefined (not found), then the ID is unique
                    isUnique = true;
                }
                attempts++;
            }
            if (!isUnique) {
                 console.error("Failed to generate a unique affiliate ID after several attempts.");
                return res.status(500).json({ message: 'Could not generate unique affiliate ID.' });
            }


            // Resolve referringAffiliateId to an actual user ID
            let referred_by_id_for_sql = null;
            if (referringAffiliateId) {
                try {
                    // Use the new helper function here
                    const referringUser = await findUserByAffiliateId(referringAffiliateId);
                    if (referringUser) {
                        referred_by_id_for_sql = referringUser.id;
                        console.log(`Referral successful: New user referred by user ID ${referred_by_id_for_sql} (affiliate_id: ${referringAffiliateId})`);
                    } else {
                        console.warn(`Referral attempt: Affiliate ID "${referringAffiliateId}" not found.`);
                    }
                } catch (dbErr) {
                    console.error("Database error checking referring affiliate ID:", dbErr);
                    // Decide if this should halt registration or just proceed without referral
                    // For now, proceed without referral
                }
            }

            // Insert new user
            const stmt = db.prepare('INSERT INTO Users (name, email, password_hash, affiliate_id, referred_by_user_id) VALUES (?, ?, ?, ?, ?)');
            stmt.run(name, email, password_hash, affiliate_id, referred_by_id_for_sql, function(err) {
                if (err) {
                    console.error("Database error (inserting user):", err);
                    return res.status(500).json({ message: 'Registration failed.', error: err.message });
                }
                res.status(201).json({ 
                    message: 'User registered successfully.', 
                    userId: this.lastID, // sqlite specific way to get last inserted ID
                    affiliateId: affiliate_id 
                });
            });
            stmt.finalize();
        });
    } catch (error) {
        console.error("Server error during registration:", error);
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});


// --- Login Endpoint ---
router.post('/login', (req, res) => {
    console.log('[Login BE] /login route hit'); // BE for Backend
    const { email, password } = req.body;

    if (!email || !password) {
        console.log('[Login BE] Email or password missing');
        return res.status(400).json({ message: 'Please provide email and password.' });
    }

    console.log('[Login BE] Attempting to find user:', email);
    db.get('SELECT * FROM Users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error("[Login BE] Database error (finding user):", err);
            return res.status(500).json({ message: 'Error logging in.', error: err.message });
        }
        if (!user) {
            console.log('[Login BE] User not found:', email);
            return res.status(401).json({ message: 'Invalid credentials. User not found.' });
        }
        console.log('[Login BE] User found:', user.email);

        // Compare password
        console.log('[Login BE] Comparing password for user:', user.email);
        const match = await bcrypt.compare(password, user.password_hash);
        console.log('[Login BE] Password match result:', match);
        if (!match) {
            console.log('[Login BE] Password incorrect for user:', user.email);
            return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' });
        }

        // Determine if user is admin
        const isAdmin = (user.email === ADMIN_EMAIL);
        console.log('[Login BE] isAdmin status for user', user.email, ':', isAdmin);

        // Generate JWT
        const tokenPayload = {
            id: user.id,
            email: user.email,
            affiliate_id: user.affiliate_id,
            name: user.name,
            isAdmin: isAdmin
        };
        console.log('[Login BE] Generating token with payload:', tokenPayload);
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

        console.log('[Login BE] Sending 200 OK response with token for user:', user.email);
        res.status(200).json({
            message: 'Logged in successfully.',
            token: token,
            userId: user.id,
            name: user.name,
            email: user.email,
            affiliateId: user.affiliate_id,
            isAdmin: isAdmin 
        });
    });
});

// --- Profile Endpoint (Protected) ---
router.get('/profile', verifyToken, (req, res) => {
    // req.user is populated by verifyToken middleware
    const userId = req.user.id;

    // The JWT now contains isAdmin, but profile data is fetched from DB
    // If verifyToken middleware is enhanced to check isAdmin from JWT for certain routes,
    // that would be separate. For now, /profile returns DB data.
    // We could also add isAdmin to the profile response if needed by frontend logic
    // that uses /profile data directly.

    db.get('SELECT id, name, email, affiliate_id FROM Users WHERE id = ?', [userId], (err, userFromDb) => {
        if (err) {
            console.error("Database error (fetching profile):", err);
            return res.status(500).json({ message: 'Error fetching profile.', error: err.message });
        }
        if (!userFromDb) {
            return res.status(404).json({ message: 'User profile not found.' });
        }

        const affiliateLink = `${YOUR_WEBSITE_URL}/?ref=${userFromDb.affiliate_id}`;
        const isAdmin = (userFromDb.email === ADMIN_EMAIL); // Determine admin status based on DB email

        res.status(200).json({
            id: userFromDb.id,
            name: userFromDb.name,
            email: userFromDb.email,
            affiliateId: userFromDb.affiliate_id,
            affiliateLink: affiliateLink,
            isAdmin: isAdmin // Also return isAdmin in profile response
        });
    });
});


module.exports = { 
    router: router, 
    verifyToken: verifyToken 
};
