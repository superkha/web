# Digital Sales Webpage with WhatsApp Integration

## Project Description
A simple e-commerce webpage that allows users to select digital products, add them to a cart, checkout, and automatically sends order details to a WhatsApp number via a backend service using Twilio.

## Setup and Running the Project

### Prerequisites
- Node.js and npm installed.
- A Twilio account with Account SID, Auth Token, and a WhatsApp-enabled Twilio phone number (if testing WhatsApp integration).
- A personal WhatsApp number to receive notifications.

### Backend Setup
1.  Navigate to the `backend` directory: `cd backend`
2.  Install dependencies: `npm install`
3.  Set up environment variables:
    Create a `.env` file in the `backend` directory with the following content (replace placeholders with your actual values):
    ```
    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_AUTH_TOKEN=your_auth_token
    TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
    RECIPIENT_WHATSAPP_NUMBER=whatsapp:+15551234567 
    ```
    (Note: For the Twilio Sandbox, the `TWILIO_WHATSAPP_NUMBER` is your Sandbox number, and `RECIPIENT_WHATSAPP_NUMBER` is your personal WhatsApp number after you've joined the Sandbox by sending the join keyword.)
4.  Start the backend server: `npm start`
    The server should run on `http://localhost:3000`.

### Frontend Setup
1.  Open the `index.html` file in your web browser.
    (No build step needed for this simple HTML/CSS/JS frontend).

## Manual Testing Checklist

### 1. Product Display
- [ ] Verify products are displayed correctly on the main page (names, descriptions, prices).

### 2. Shopping Cart Functionality
- [ ] Add items to the cart: Click "Add to Cart" buttons.
- [ ] Verify items appear in the shopping cart section.
- [ ] Verify the total price updates correctly as items are added.
- [ ] Remove items from the cart: Click "Remove" buttons next to cart items.
- [ ] Verify items are removed from the cart display.
- [ ] Verify the total price updates correctly as items are removed.
- [ ] Test adding multiple units of the same item (Note: current implementation adds as separate entries; this is acceptable based on current scope).
- [ ] Test emptying the cart and ensuring the total price is $0.00.

### 3. Checkout Process
- [ ] Fill in the checkout form fields: Name, Email, Phone Number.
- [ ] Click "Place Order".

### 4. Backend Data Reception (Check Backend Console)
- [ ] Verify the backend server logs the correct customer details.
- [ ] Verify the backend server logs the correct cart items and total price.
- [ ] Verify the backend server logs a success message like "Order received successfully!" or "Order received and notification sent!".

### 5. WhatsApp Integration (Requires Twilio Setup)
- [ ] If Twilio is configured correctly and the backend successfully sent the message:
    - [ ] Verify a WhatsApp message is received at the `RECIPIENT_WHATSAPP_NUMBER`.
    - [ ] Verify the WhatsApp message content matches the order details (customer info, items, total).
- [ ] If Twilio details are incorrect or there's an issue:
    - [ ] Verify the backend console logs an error related to Twilio.
    - [ ] Verify the frontend shows an appropriate message (e.g., "Order received, but failed to send WhatsApp notification.").

### 6. Frontend Post-Order Behavior
- [ ] Verify an alert message "Order placed successfully!" (or similar) is shown on successful submission.
- [ ] Verify the shopping cart is cleared on the webpage.
- [ ] Verify the total price is reset to $0.00 on the webpage.
- [ ] Verify the checkout form fields are cleared.

### 7. Error Handling (Optional - Advanced)
- [ ] Test submitting the form with empty required fields (HTML5 validation should prevent this).
- [ ] Test what happens if the backend server is not running when an order is placed (frontend should show an error).
