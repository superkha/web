const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path'); // Ensure path is required
const { db, initializeDB } = require('./database'); 
const { verifyToken } = require('./authRoutes'); 

const app = express();
const port = 3000;

// --- Twilio Configuration ---
// IMPORTANT SECURITY NOTE:
// In a production environment, API keys, tokens, and sensitive phone numbers
// should be stored securely as environment variables and not hardcoded.
// The recipient number should also be configurable, not hardcoded.
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 34 chars, starts with AC
const authToken = process.env.TWILIO_AUTH_TOKEN || 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';   // 32 chars (can be any string for placeholder)
const twilioClient = twilio(accountSid, authToken);
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio Sandbox or your number
const recipientWhatsAppNumber = process.env.RECIPIENT_WHATSAPP_NUMBER || 'whatsapp:+YOUR_RECIPIENT_WHATSAPP_NUMBER'; // Your WhatsApp number

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'uploads' directory
// This makes images accessible via URLs like /uploads/products/image.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Authentication Routes ---
const { router: authRouter } = require('./authRoutes'); // Import and destructure the router
app.use('/api/auth', authRouter);          // Mount the destructured authRouter

// --- Affiliate Routes ---
const affiliateRoutes = require('./affiliateRoutes'); // Import affiliate routes
app.use('/api/affiliate', affiliateRoutes);       // Mount them under /api/affiliate

// --- Admin Routes ---
const adminRoutes = require('./adminRoutes'); // Import admin routes
app.use('/api/admin', adminRoutes);           // Mount them under /api/admin

// --- Product Routes (Public) ---
const productRoutes = require('./productRoutes'); // Import product routes
app.use('/api/products', productRoutes);        // Mount them under /api/products

// API endpoint for submitting orders
app.post('/api/submit-order', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const loggedInUserEmail = req.user.email;

    const { customerDetails, cartItems } = req.body;

    if (!customerDetails || !customerDetails.name || !customerDetails.email || !customerDetails.phone) {
        return res.status(400).json({ message: "Customer details (name, email, phone) are required." });
    }
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ message: "Cart items are required." });
    }

    console.log(`Processing order for user ID: ${userId}`);
    console.log('Customer Details:', customerDetails);
    console.log('Cart Items from frontend:', cartItems);

    try {
        const orderProcessingResult = await new Promise((resolveOuter, rejectOuter) => {
            db.serialize(async () => {
                try {
                    await new Promise((resolve, reject) => {
                        db.run("BEGIN TRANSACTION", (err) => {
                            if (err) { return reject(err); }
                            resolve();
                        });
                    });

                    let calculatedTotalAmount = 0;
                    const orderProductDetails = [];

                    for (const item of cartItems) {
                        const product = await new Promise((resolve, reject) => {
                            db.get('SELECT id, name, price FROM Products WHERE id = ?', [item.productId], (err, productRow) => {
                                if (err) return reject(new Error(`Database error fetching product ID ${item.productId}.`));
                                if (!productRow) return reject(new Error(`Product with ID ${item.productId} not found.`));
                                resolve(productRow);
                            });
                        });
                        calculatedTotalAmount += product.price; // Assuming quantity 1
                        orderProductDetails.push({
                            productId: product.id,
                            name: product.name,
                            quantity: 1, // Assuming quantity 1
                            priceAtPurchase: product.price
                        });
                    }

                    const orderStmt = db.prepare('INSERT INTO Orders (user_id, total_amount, customer_name, customer_email, customer_phone, status) VALUES (?, ?, ?, ?, ?, ?)');
                    const orderResult = await new Promise((resolve, reject) => {
                        orderStmt.run(userId, calculatedTotalAmount, customerDetails.name, customerDetails.email, customerDetails.phone, 'pending', function(err) {
                            if (err) reject(err); else resolve({ lastID: this.lastID });
                        });
                    });
                    orderStmt.finalize(err => { if (err) console.error("Error finalizing orderStmt:", err.message);});
                    const newOrderId = orderResult.lastID;

                    const orderItemStmt = db.prepare('INSERT INTO OrderItems (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)');
                    for (const detail of orderProductDetails) {
                        await new Promise((resolve, reject) => { // Await each item insert if order matters or to catch individual errors
                            orderItemStmt.run(newOrderId, detail.productId, detail.quantity, detail.priceAtPurchase, err => {
                                if (err) reject(err); else resolve();
                            });
                        });
                    }
                    await new Promise((resolve, reject) => orderItemStmt.finalize(err => err ? reject(err) : resolve()));
                    
                    // --- Commission Calculation and Recording ---
                    const currentCustomer = await new Promise((resolve, reject) => {
                        db.get('SELECT referred_by_user_id FROM Users WHERE id = ?', [userId], (err, row) => {
                            if (err) reject(err); else resolve(row);
                        });
                    });
                    const actualReferringUserId = currentCustomer ? currentCustomer.referred_by_user_id : null;

                    if (actualReferringUserId) {
                        let commissionRate = 0.10; // Default
                        const setting = await new Promise((resolve, reject) => {
                            db.get("SELECT setting_value FROM AffiliateSettings WHERE setting_name = 'default_commission_rate'", (err, row) => {
                                if (err) reject(err); else resolve(row);
                            });
                        });
                        if (setting && setting.setting_value) {
                            const parsedRate = parseFloat(setting.setting_value);
                            if (!isNaN(parsedRate)) commissionRate = parsedRate;
                            else console.warn("Failed to parse commission rate from settings, using default 0.10");
                        } else {
                            console.log("No default_commission_rate found in AffiliateSettings, using default 0.10");
                        }
                        const commissionEarned = calculatedTotalAmount * commissionRate;
                        const commissionStmt = db.prepare('INSERT INTO AffiliateReferrals (referring_user_id, referred_user_id, referred_order_id, commission_rate_at_referral, commission_earned, status) VALUES (?, ?, ?, ?, ?, ?)');
                        await new Promise((resolve, reject) => {
                            commissionStmt.run(actualReferringUserId, userId, newOrderId, commissionRate, commissionEarned, 'pending', err => {
                                if (err) reject(err); else resolve();
                            });
                        });
                        await new Promise((resolve, reject) => commissionStmt.finalize(err => err ? reject(err) : resolve()));
                        console.log(`Commission of $${commissionEarned.toFixed(2)} recorded for referring user ID ${actualReferringUserId}.`);
                    }
                    
                    await new Promise((resolve, reject) => {
                        db.run("COMMIT", (err) => {
                            if (err) { return reject(err); } // This reject would be caught by processingError
                            console.log(`Transaction committed for order ID: ${newOrderId}`);
                            resolve();
                        });
                    });
                    // console.log(`Order ${newOrderId} committed successfully. Total: $${calculatedTotalAmount.toFixed(2)}`); // Moved log into promise
                    resolveOuter({ orderId: newOrderId, totalAmount: calculatedTotalAmount, products: orderProductDetails });

                } catch (processingError) {
                    console.error("Error during transaction, attempting rollback:", processingError.message);
                    db.run("ROLLBACK", (rollbackErr) => { // Rollback is best-effort here
                        if (rollbackErr) console.error("Rollback failed:", rollbackErr.message);
                        else console.log("Transaction rolled back successfully.");
                    });
                    // Ensure rejectOuter is called with an Error object
                    if (processingError instanceof Error) {
                        rejectOuter(processingError);
                    } else {
                        rejectOuter(new Error(`Transaction failed: ${String(processingError)}`));
                    }
                }
            }); // End db.serialize
        }); // End new Promise for orderProcessingResult

        // --- Post-Commit Actions (if orderProcessingResult is resolved) ---
        let twilioMessageBody = `New Order #${orderProcessingResult.orderId}!\n\n`;
        twilioMessageBody += `Customer:\n  Name: ${customerDetails.name}\n  Email: ${customerDetails.email}\n  Phone: ${customerDetails.phone}\n\n`;
        twilioMessageBody += `Items:\n`;
        orderProcessingResult.products.forEach(item => {
            twilioMessageBody += `  - ${item.name} (${item.quantity} x $${item.priceAtPurchase.toFixed(2)})\n`;
        });
        twilioMessageBody += `\nTotal: $${orderProcessingResult.totalAmount.toFixed(2)}`;
        twilioMessageBody += `\n\nOrder placed by user: ${loggedInUserEmail} (ID: ${userId})`;

        try {
            await twilioClient.messages.create({
                from: twilioWhatsAppNumber,
                to: recipientWhatsAppNumber,
                body: twilioMessageBody
            });
            console.log('Twilio notification sent for order:', orderProcessingResult.orderId);
        } catch (twilioError) {
            console.error('Failed to send Twilio notification for order', orderProcessingResult.orderId, twilioError);
        }
        
        res.status(201).json({ 
            message: 'Order placed successfully!', 
            orderId: orderProcessingResult.orderId, 
            totalAmount: orderProcessingResult.totalAmount 
        });

    } catch (error) { // Catches rejections from orderProcessingResult promise or other errors
        console.error("Unhandled error in /api/submit-order:", error);
        res.status(error.status || 400).json({ message: error.message || 'Server error while processing order.' });
    }
});

// Start the server
app.listen(port, () => {
    initializeDB(); // Initialize the database when the server starts
    console.log(`Server is running on http://localhost:${port}`);
});
