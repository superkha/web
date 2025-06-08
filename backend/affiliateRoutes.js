const express = require('express');
const { db } = require('./database'); // Assuming db is exported from database.js
const { verifyToken } = require('./authRoutes'); // Import verifyToken middleware

const router = express.Router();

// Configuration (Consider moving to a shared config file or environment variables)
const YOUR_WEBSITE_URL = process.env.FRONTEND_URL || 'http://localhost:8080'; // Or your actual frontend URL

// --- Helper function to query the database ---
// This simplifies running single queries with promises
function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error("Database query error:", err.message, "SQL:", sql, "Params:", params);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Helper function to query all rows from the database
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


// --- GET Affiliate Statistics Endpoint ---
router.get('/stats', verifyToken, async (req, res) => {
    const affiliateUserId = req.user.id;

    try {
        const [
            referralsSignedUp,
            referredOrders,
            commissionPending,
            commissionPaidOrApproved,
            userAffiliateDetails
        ] = await Promise.all([
            dbQuery('SELECT COUNT(*) as count FROM Users WHERE referred_by_user_id = ?', [affiliateUserId]),
            dbQuery('SELECT COUNT(*) as count FROM AffiliateReferrals WHERE referring_user_id = ?', [affiliateUserId]),
            dbQuery("SELECT SUM(commission_earned) as total FROM AffiliateReferrals WHERE referring_user_id = ? AND status = 'pending'", [affiliateUserId]),
            dbQuery("SELECT SUM(commission_earned) as total FROM AffiliateReferrals WHERE referring_user_id = ? AND (status = 'paid' OR status = 'approved')", [affiliateUserId]),
            dbQuery('SELECT affiliate_id FROM Users WHERE id = ?', [affiliateUserId])
        ]);

        const affiliateLink = (userAffiliateDetails && userAffiliateDetails.affiliate_id) ?
            `${YOUR_WEBSITE_URL}/?ref=${userAffiliateDetails.affiliate_id}` :
            'N/A';

        res.status(200).json({
            total_referrals_signed_up: (referralsSignedUp && referralsSignedUp.count) || 0,
            total_referred_orders: (referredOrders && referredOrders.count) || 0,
            total_commission_pending: (commissionPending && commissionPending.total) || 0,
            total_commission_paid_or_approved: (commissionPaidOrApproved && commissionPaidOrApproved.total) || 0,
            affiliate_link: affiliateLink
        });

    } catch (error) {
        console.error("Error fetching affiliate stats:", error);
        res.status(500).json({ message: 'Failed to fetch affiliate statistics.', error: error.message });
    }
});


// --- GET Affiliate Referrals (Orders) Endpoint ---
router.get('/referrals', verifyToken, async (req, res) => {
    const affiliateUserId = req.user.id;

    const sql = `
        SELECT 
            ar.referred_order_id, 
            ar.commission_earned, 
            ar.commission_rate_at_referral, 
            ar.status as commission_status, 
            ar.created_at as commission_date, 
            o.order_date, 
            o.total_amount as order_total_amount
        FROM AffiliateReferrals ar
        JOIN Orders o ON ar.referred_order_id = o.id
        WHERE ar.referring_user_id = ?
        ORDER BY o.order_date DESC
    `;

    try {
        const referrals = await dbQueryAll(sql, [affiliateUserId]);
        res.status(200).json(referrals);
    } catch (error) {
        console.error("Error fetching affiliate referrals:", error);
        res.status(500).json({ message: 'Failed to fetch affiliate referrals.', error: error.message });
    }
});

module.exports = router;