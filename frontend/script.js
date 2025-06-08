// frontend/script.js
// JavaScript for e-commerce site functionality
/*jshint esversion: 5 */ // Assuming JSHint is still desired for this file in ES5 mode

// --- Global DOM Elements ---
var registerForm, loginForm, userAuthSection, userProfileSection, logoutButton;
var profileName, profileEmail, profileAffiliateId, profileAffiliateLink;
var sidebar, sidebarToggle; // Added sidebar and toggle
var checkoutNameInput, checkoutEmailInput, checkoutPhoneInput;

// Affiliate Dashboard Elements
var affiliateDashboardSection, affiliateLinkDisplay, affiliateStatsDiv, statsTotalSignups,
    statsTotalOrders, statsPendingCommission, statsPaidCommission, affiliateReferralsList;

// Checkout Button and Message
var placeOrderButton, checkoutAuthMessage;

// Admin Page Link
var adminPageLink;

// Sidebar Elements (already declared: sidebar, sidebarToggle)

// --- Cart and Product Elements ---
var cartItemsContainer, totalPriceElement, checkoutForm;
var productsContainer;

// --- API Base URL ---
var API_BASE_URL = 'http://localhost:3000/api';

// --- Cart State ---
var cart = [];

// --- Helper: Format Currency (Assumed to be from i18n.js or globally available if i18n.js is loaded first) ---
// If i18n.js is guaranteed to be loaded first and i18n.formatCurrency exists:
// var formatCurrency = i18n.formatCurrency; 
// Otherwise, if it was defined in script.js:
function formatCurrency(value) {
    var num = parseFloat(value);
    // Assuming i18n.currentLanguage is available for locale-specific formatting if needed,
    // but for "MXN" prefix, this is simple.
    // For now, using the one from i18n.js which doesn't exist, so define locally for safety for now.
    return 'MXN ' + (isNaN(num) ? '0.00' : num.toFixed(2));
}


// --- Helper: Update UI based on Authentication State ---
function updateAuthStateUI(isLoggedIn) {
    console.time('updateAuthStateUI_DOM');
    var userSpecificHeaderButtonIds = [
        'header-credits-button',
        'header-tasks-button',
        'header-cart-button',
        'header-avatar-button'
    ];

    // Ensure sidebar and sidebarToggle are defined before using them here.
    // They are selected in DOMContentLoaded, so this function relies on that timing.
    if (isLoggedIn) {
        if (userAuthSection) userAuthSection.classList.add('hidden');
        if (userProfileSection) userProfileSection.classList.remove('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');
        if (affiliateDashboardSection) affiliateDashboardSection.classList.remove('hidden');
        
        // Sidebar initial state for logged-in user: Hidden
        if (sidebar) {
            sidebar.classList.add('hidden'); // Ensure sidebar is hidden initially
        }
        if (sidebarToggle) {
            sidebarToggle.classList.remove('hidden');      // Show the toggle button
            sidebarToggle.classList.remove('sidebar-toggle-active'); // Set to 'closed' icon state
            sidebarToggle.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('sidebar-content-shifted'); // Ensure content is NOT shifted initially

        if (adminPageLink) {
            if (localStorage.getItem('isAdmin') === 'true') {
                adminPageLink.classList.remove('hidden');
            } else {
                adminPageLink.classList.add('hidden');
            }
        }

        if (placeOrderButton) placeOrderButton.disabled = false;
        if (checkoutAuthMessage) checkoutAuthMessage.classList.add('hidden');
        if (checkoutNameInput) checkoutNameInput.disabled = false;
        if (checkoutEmailInput) checkoutEmailInput.disabled = false;
        if (checkoutPhoneInput) checkoutPhoneInput.disabled = false;

        userSpecificHeaderButtonIds.forEach(function(buttonId) {
            var button = document.getElementById(buttonId);
            if (button) {
                button.classList.remove('hidden');
            }
        });

    } else {
        if (userAuthSection) userAuthSection.classList.remove('hidden');
        if (userProfileSection) userProfileSection.classList.add('hidden');
        if (logoutButton) logoutButton.classList.add('hidden');
        if (sidebar) {
            sidebar.classList.add('hidden'); 
            document.body.classList.remove('sidebar-content-shifted'); // Unshift content
        }
        if (sidebarToggle) {
            sidebarToggle.classList.add('hidden'); 
            sidebarToggle.classList.remove('sidebar-toggle-active'); 
            sidebarToggle.setAttribute('aria-expanded', 'false');
        }
        if (affiliateDashboardSection) {
            affiliateDashboardSection.classList.add('hidden');
            // Clear affiliate dashboard data on logout
            if (affiliateLinkDisplay) affiliateLinkDisplay.textContent = 'N/A';
            if (statsTotalSignups) statsTotalSignups.textContent = '0';
            if (statsTotalOrders) statsTotalOrders.textContent = '0';
            if (statsPendingCommission) statsPendingCommission.textContent = formatCurrency(0);
            if (statsPaidCommission) statsPaidCommission.textContent = formatCurrency(0);
            if (affiliateReferralsList) affiliateReferralsList.innerHTML = '';
        }
        if (adminPageLink) adminPageLink.classList.add('hidden'); 

        if (placeOrderButton) placeOrderButton.disabled = true;
        if (checkoutAuthMessage) {
            checkoutAuthMessage.textContent = typeof i18n !== 'undefined' ? i18n.getTranslation("text_please_login_or_register", "Please log in or register to place an order.") : "Please log in or register to place an order.";
            checkoutAuthMessage.classList.remove('hidden');
        }
        if (checkoutNameInput) { checkoutNameInput.disabled = true; checkoutNameInput.value = ''; }
        if (checkoutEmailInput) { checkoutEmailInput.disabled = true; checkoutEmailInput.value = ''; }
        if (checkoutPhoneInput) { checkoutPhoneInput.disabled = true; checkoutPhoneInput.value = ''; }

        userSpecificHeaderButtonIds.forEach(function(buttonId) {
            var button = document.getElementById(buttonId);
            if (button) {
                button.classList.add('hidden');
            }
        });

        if (profileName) profileName.textContent = '';
        if (profileEmail) profileEmail.textContent = '';
        if (profileAffiliateId) profileAffiliateId.textContent = '';
        if (profileAffiliateLink) {
            profileAffiliateLink.textContent = '';
            profileAffiliateLink.href = '#';
        }
    }
    console.timeEnd('updateAuthStateUI_DOM');
}

// --- Fetch Affiliate Dashboard Data ---
function fetchAffiliateDashboardData() {
    var token = localStorage.getItem('authToken');
    if (!token || !affiliateDashboardSection || affiliateDashboardSection.classList.contains('hidden')) {
        // Don't fetch if not logged in or dashboard isn't visible (e.g. user not admin for an admin dashboard)
        // Or if section doesn't exist on the page (e.g. on admin.html if dashboard is only on index.html)
        return Promise.resolve(); // Return a resolved promise
    }
    console.time('fetchAffiliateDashboardData_Overall');

    // Clear previous data first
    if (affiliateLinkDisplay) affiliateLinkDisplay.textContent = i18n.getTranslation("text_loading", "Loading...");
    if (statsTotalSignups) statsTotalSignups.textContent = '...';
    if (statsTotalOrders) statsTotalOrders.textContent = '...';
    if (statsPendingCommission) statsPendingCommission.textContent = '...';
    if (statsPaidCommission) statsPaidCommission.textContent = '...';
    if (affiliateReferralsList) affiliateReferralsList.innerHTML = '<p>' + i18n.getTranslation("text_loading_referrals", "Loading referrals...") + '</p>';


    var statsPromise = fetch(API_BASE_URL + '/affiliate/stats', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    var referralsPromise = fetch(API_BASE_URL + '/affiliate/referrals', {
        headers: { 'Authorization': 'Bearer ' + token }
    });

    return Promise.all([statsPromise, referralsPromise])
        .then(function(responses) {
            var statsJsonPromise = responses[0].ok ? responses[0].json() : Promise.resolve(null); // Allow graceful fail
            var referralsJsonPromise = responses[1].ok ? responses[1].json() : Promise.resolve(null); // Allow graceful fail
            
            if (!responses[0].ok) console.error('Failed to fetch affiliate stats:', responses[0].status);
            if (!responses[1].ok) console.error('Failed to fetch affiliate referrals:', responses[1].status);

            return Promise.all([statsJsonPromise, referralsJsonPromise]);
        })
        .then(function(results) {
            var statsData = results[0];
            var referralsData = results[1];

            console.time('fetchAffiliateDashboardData_DOMUpdates');
            if (statsData) {
                if (affiliateLinkDisplay) affiliateLinkDisplay.textContent = statsData.affiliate_link || 'N/A';
                if (statsTotalSignups) statsTotalSignups.textContent = statsData.total_referrals_signed_up || 0;
                if (statsTotalOrders) statsTotalOrders.textContent = statsData.total_referred_orders || 0;
                if (statsPendingCommission) statsPendingCommission.textContent = formatCurrency(statsData.total_commission_pending || 0);
                if (statsPaidCommission) statsPaidCommission.textContent = formatCurrency(statsData.total_commission_paid_or_approved || 0);
            } else {
                 if (affiliateLinkDisplay) affiliateLinkDisplay.textContent = i18n.getTranslation("text_error_loading", "Error loading");
            }

            if (affiliateReferralsList) {
                affiliateReferralsList.innerHTML = ''; // Clear loading message
                if (referralsData && referralsData.length === 0) {
                    affiliateReferralsList.innerHTML = '<p>' + i18n.getTranslation("text_no_referrals_yet", "No referrals yet.") + '</p>';
                } else if (referralsData) {
                    var ul = document.createElement('ul');
                    referralsData.forEach(function(ref) { // ES5 forEach for NodeList if necessary, but this is an array
                        var li = document.createElement('li');
                        var orderDate = new Date(ref.order_date).toLocaleDateString();
                        // Example: Order ID: 101 | Date: 01/01/2024 | Order Total: MXN 50.00 | Commission: MXN 5.00 | Rate: 10% | Status: pending
                        li.innerHTML = 'Order ID: ' + ref.referred_order_id +
                                     ' | Date: ' + orderDate +
                                     ' | Order Total: ' + formatCurrency(ref.order_total_amount) +
                                     ' | Commission: ' + formatCurrency(ref.commission_earned) +
                                     ' | Rate: ' + (ref.commission_rate_at_referral * 100).toFixed(0) + '%' +
                                     ' | Status: ' + ref.commission_status;
                        ul.appendChild(li);
                    });
                    affiliateReferralsList.appendChild(ul);
                } else {
                     affiliateReferralsList.innerHTML = '<p>' + i18n.getTranslation("error_loading_referrals", "Error loading referrals.") + '</p>';
                }
            }
            console.timeEnd('fetchAffiliateDashboardData_DOMUpdates');
        })
        .catch(function(error) {
            console.error('Error fetching affiliate dashboard data:', error);
            if (affiliateLinkDisplay) affiliateLinkDisplay.textContent = i18n.getTranslation("text_error_loading", "Error loading");
            if (affiliateReferralsList) affiliateReferralsList.innerHTML = '<p>' + i18n.getTranslation("error_loading_referrals", "Error loading referrals.") + '</p>';
        })
        .finally(function() {
            console.timeEnd('fetchAffiliateDashboardData_Overall');
        });
}

// --- Fetch User Profile ---
function fetchProfile() {
    var token = localStorage.getItem('authToken');
    if (!token) {
        updateAuthStateUI(false);
        return Promise.resolve(); // Return a resolved promise
    }
    console.time('fetchProfile_Overall');

    return fetch(API_BASE_URL + '/auth/profile', {
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
    .then(function(response) {
        if (response.ok) {
            return response.json();
        } else {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('isAdmin');
            }
            console.error('Failed to fetch profile:', response.status);
            // Throw an error to be caught by the catch block
            throw new Error('Failed to fetch profile, status: ' + response.status);
        }
    })
    .then(function(profile) {
        console.log('[Profile] Profile data received by frontend:', profile);
        console.time('fetchProfile_DOMUpdates');
        if (profileName) profileName.textContent = profile.name;
        if (profileEmail) profileEmail.textContent = profile.email;
        if (profileAffiliateId) profileAffiliateId.textContent = profile.affiliateId;
        if (profileAffiliateLink) {
            profileAffiliateLink.textContent = profile.affiliateLink;
            profileAffiliateLink.href = profile.affiliateLink;
        }
        // Store for avatar dropdown
        localStorage.setItem('userName', profile.name);
        if (profile.avatar_url) { 
            localStorage.setItem('userAvatarUrl', profile.avatar_url);
        } else {
            localStorage.removeItem('userAvatarUrl'); 
        }
        if (checkoutNameInput) checkoutNameInput.value = profile.name;
        if (checkoutEmailInput) checkoutEmailInput.value = profile.email;
        
        if (profile.hasOwnProperty('isAdmin')) {
            localStorage.setItem('isAdmin', profile.isAdmin ? 'true' : 'false');
        }
        console.timeEnd('fetchProfile_DOMUpdates');
        updateAuthStateUI(true);
        return fetchAffiliateDashboardData(); // Chain promise
    })
    .catch(function(error) {
        console.error('Error fetching profile:', error);
        localStorage.removeItem('isAdmin'); // Clear isAdmin on error too
        updateAuthStateUI(false);
    })
    .finally(function() {
        console.timeEnd('fetchProfile_Overall');
    });
}

// --- Registration Form Handler ---
function handleRegistration(event) {
    event.preventDefault();
    console.log('[Register] handleRegistration function called.');
    var name = document.getElementById('register-name').value;
    var email = document.getElementById('register-email').value;
    var password = document.getElementById('register-password').value;
    var referringAffiliateId = sessionStorage.getItem('referringAffiliateId');
    
    var requestBody = { name: name, email: email, password: password };
    if (referringAffiliateId) {
        requestBody.referringAffiliateId = referringAffiliateId;
    }

    var fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    };
    
    var responseOk;

    fetch(API_BASE_URL + '/auth/register', fetchOptions)
        .then(function(response) {
            console.log('[Register] Raw response:', response);
            responseOk = response.ok;
            console.log('[Register] response.ok:', responseOk);
            return response.json();
        })
        .then(function(data) {
            console.log('[Register] Parsed data:', data);
            console.log('[Register] responseOk status (carried over):', responseOk);
            if (responseOk) {
                console.log('[Register] Attempting to show success alert.');
                alert(i18n.getTranslation("text_registration_success", "Registration successful! Please log in."));
                if (registerForm) registerForm.reset();
            } else {
                console.log('[Register] Attempting to show failure alert. Reason:', data.message || 'Backend did not provide a message.');
                alert(i18n.getTranslation("alert_registration_failed_reason", "Registration failed: {reason}").replace("{reason}", data.message || 'Unknown reason from backend'));
            }
        })
        .catch(function(error) {
            console.error('Registration error:', error);
            alert(i18n.getTranslation("alert_registration_error_generic", "An error occurred during registration. Check console."));
        });
}

// --- Login Form Handler ---
function handleLogin(event) {
    console.log('[Login] handleLogin function has been CALLED! (Top of function)');
    event.preventDefault();
    console.log('[Login] event.preventDefault() HAS BEEN CALLED.');

    var email = document.getElementById('login-email').value;
    var password = document.getElementById('login-password').value;
    
    var fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
    };

    var responseOk; 

    fetch(API_BASE_URL + '/auth/login', fetchOptions)
        .then(function(response) {
            console.log('[Login] Raw response:', response);
            responseOk = response.ok;
            console.log('[Login] response.ok:', responseOk);
            // If response is not ok, or if it's a 204, .json() might fail or return null.
            // It's better to check responseOk before calling .json() if body might be empty.
            // However, our login is expected to return JSON.
            return response.json(); 
        })
        .then(function(result) { // 'result' is the parsed JSON data
            console.log('[Login] Parsed data:', result);
            console.log('[Login] responseOk status (carried over):', responseOk);

            if (responseOk) {
                console.log('[Login] Attempting to store tokens and update UI.');
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('isAdmin', result.isAdmin ? 'true' : 'false');
                if (loginForm) loginForm.reset();
                
                fetchProfile(); // Call fetchProfile to update UI and get more data

                alert(i18n.getTranslation("text_login_success", "Login successful!"));
            } else {
                console.log('[Login] Attempting to show failure alert. Reason:', result.message || 'Backend did not provide a message.');
                alert(i18n.getTranslation("alert_login_failed_reason", "Login failed: {reason}").replace("{reason}", result.message || 'Unknown reason from backend'));
            }
        })
        .catch(function(error) {
            console.error('Login error:', error); // This catches network errors or errors from .json()
            alert(i18n.getTranslation("alert_login_error_generic", "An error occurred during login. Check console."));
        });
}

// --- Logout Handler ---
function handleLogout() {
    console.time('handleLogout_DOM');
    localStorage.removeItem('authToken');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userName'); 
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userAvatarUrl'); // Remove avatar URL on logout
    
    updateAuthStateUI(false); // This will hide profile, clear fields etc.
    
    // Clear cart explicitly on logout
    cart = [];
    if(typeof renderCart === 'function') renderCart();

    alert(i18n.getTranslation("alert_logout_success", "You have been logged out."));
    console.timeEnd('handleLogout_DOM');
}

// --- Cart Functions ---
function calculateTotalPrice() {
    return cart.reduce(function(total, item) { return total + item.price; }, 0);
}

function handleAddToCartClick(event) {
    var productElement = event.target.closest('div.product[data-product-id]');
    if (!productElement) { console.error("Product element not found for Add to Cart."); return; }

    var productId = productElement.dataset.productId;
    // Get name and price from the element itself for simplicity, though ideally from a product data store
    var productNameElement = productElement.querySelector('h2');
    var productName = productNameElement ? productNameElement.textContent : 'Unknown Product';
    var productPrice = parseFloat(productElement.dataset.price); // Use data-price for raw numerical value

    if (productId && productName && !isNaN(productPrice)) {
        var existingItem = null;
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].productId === productId) {
                existingItem = cart[i];
                break;
            }
        }
        if (!existingItem) {
            cart.push({ productId: productId, name: productName, price: productPrice, quantity: 1 }); // Add quantity
            renderCart();
        } else {
            alert(i18n.getTranslation("alert_product_already_in_cart", "This product is already in your cart."));
        }
    } else {
        console.error("Product data (ID, name, or price) invalid for Add to Cart.", "ID:", productId, "Name:", productName, "Price:", productPrice);
    }
}

function setupAddToCartButtons() {
    var buttons = document.querySelectorAll('.add-to-cart');
    Array.prototype.forEach.call(buttons, function(button) {
        // Remove existing listener before adding to prevent duplicates if this is called multiple times
        button.removeEventListener('click', handleAddToCartClick); 
        button.addEventListener('click', handleAddToCartClick);
    });
}

function renderCart() {
    console.time('renderCartItems');
    if (!cartItemsContainer || !totalPriceElement) {
        console.error("Cart DOM elements not found for rendering.");
        console.timeEnd('renderCartItems');
        return;
    }
    cartItemsContainer.innerHTML = ''; // Clear previous items
    var currentTotalPrice = 0;
    cart.forEach(function(item, index) {
        var cartItemDiv = document.createElement('div');
        cartItemDiv.textContent = item.name + ' - ' + formatCurrency(item.price) + ' '; // Display quantity later

        var removeButton = document.createElement('button');
        removeButton.textContent = i18n.getTranslation("btn_remove", "Remove");
        removeButton.classList.add('remove-from-cart'); // For styling
        removeButton.addEventListener('click', function() {
            cart.splice(index, 1); // Remove item from cart array
            renderCart(); // Re-render the cart
        });
        cartItemDiv.appendChild(removeButton);
        cartItemsContainer.appendChild(cartItemDiv);
        currentTotalPrice += item.price; // Assuming quantity 1 for now
    });
    totalPriceElement.textContent = formatCurrency(currentTotalPrice);
    console.timeEnd('renderCartItems');
}

// --- Product Fetching and Rendering ---
function fetchAndRenderProducts() {
    console.time('renderAllProducts');
    var loadingMessageEl = document.getElementById('products-loading-message');
    
    if (!productsContainer) {
        if (loadingMessageEl) loadingMessageEl.textContent = i18n.getTranslation("error_failed_to_load_products", "Products display area not found.");
        console.timeEnd('renderAllProducts');
        return;
    }
    if (loadingMessageEl) { // Show loading message
        loadingMessageEl.textContent = i18n.getTranslation("text_loading_products", "Loading products...");
        loadingMessageEl.style.display = 'block';
    }

    fetch(API_BASE_URL + '/products')
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            return response.json();
        })
        .then(function(products) {
            if (loadingMessageEl) loadingMessageEl.style.display = 'none';
            productsContainer.innerHTML = ''; // Clear previous products or loading message

            if (products.length === 0) {
                productsContainer.innerHTML = '<p>' + i18n.getTranslation("text_no_products_found", "No products found.") + '</p>';
                console.timeEnd('renderAllProducts');
                return;
            }

            products.forEach(function(product) {
                var productDiv = document.createElement('div');
                productDiv.classList.add('product');
                productDiv.dataset.productId = product.id;
                productDiv.dataset.price = product.price; // Store raw price for cart logic

                var categoryPrefix = i18n.getTranslation("product_label_category_prefix", "Category:");
                var addToCartText = i18n.getTranslation("btn_add_to_cart", "Add to Cart");

                productDiv.innerHTML =
                    '<img src="' + (product.image_url || 'https://dummyimage.com/150x150/404040/eeeeee.png&amp;text=No+Image') + '" alt="' + product.name + '" style="width:100%; height:200px; object-fit:cover; border-radius:4px; margin-bottom:15px;">' + // Adjusted style to match previous dynamic
                    '<h2>' + product.name + '</h2>' +
                    '<p class="description">' + (product.description || '') + '</p>' +
                    '<p class="category">' + categoryPrefix + ' ' + (product.category || 'N/A') + '</p>' +
                    '<p class="price">' + formatCurrency(product.price) + '</p>' +
                    '<button class="add-to-cart">' + addToCartText + '</button>';
                productsContainer.appendChild(productDiv);
            });
            setupAddToCartButtons(); // Re-attach listeners to new buttons
            console.timeEnd('renderAllProducts');
        })
        .catch(function(error) {
            console.error('Failed to load products:', error);
            if (productsContainer) productsContainer.innerHTML = '<p>' + i18n.getTranslation("error_failed_to_load_products", "Failed to load products. Please try again later.") + '</p>';
            if (loadingMessageEl && productsContainer.innerHTML === '') {
                loadingMessageEl.textContent = i18n.getTranslation("text_failed_to_load_products_short", "Failed to load products.");
                loadingMessageEl.style.display = 'block';
            }
            console.timeEnd('renderAllProducts'); // End time in case of error too
        });
}


// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function() { // Removed async as initializeI18n now returns a promise
    console.log("DOM fully loaded and parsed");

    var i18nPromise = (typeof i18n !== 'undefined' && typeof i18n.initializeI18n === 'function') ?
        i18n.initializeI18n() : 
        Promise.reject(new Error("i18n module not loaded correctly for script.js."));

    i18nPromise.then(function() {
        console.log("i18n initialized, proceeding with UI setup.");
        // Select DOM elements (moved here to ensure they are selected after DOM ready)
        registerForm = document.getElementById('register-form');
        loginForm = document.getElementById('login-form');
        userAuthSection = document.getElementById('user-auth');
        userProfileSection = document.getElementById('user-profile');
        logoutButton = document.getElementById('logout-button');
        profileName = document.getElementById('profile-name');
        profileEmail = document.getElementById('profile-email');
        profileAffiliateId = document.getElementById('profile-affiliate-id');
        profileAffiliateLink = document.getElementById('profile-affiliate-link');
        
        sidebar = document.getElementById('sidebar'); // Select sidebar
        sidebarToggle = document.getElementById('sidebar-toggle'); // Select toggle button

        checkoutNameInput = document.getElementById('checkout-name');
        checkoutEmailInput = document.getElementById('checkout-email');
        checkoutPhoneInput = document.getElementById('checkout-phone');

        affiliateDashboardSection = document.getElementById('affiliate-dashboard');
        affiliateLinkDisplay = document.getElementById('affiliate-link-display');
        // affiliateStatsDiv = document.getElementById('affiliate-stats'); // This ID was on a div, not individual stats
        statsTotalSignups = document.getElementById('stats-total-signups');
        statsTotalOrders = document.getElementById('stats-total-orders');
        statsPendingCommission = document.getElementById('stats-pending-commission');
        statsPaidCommission = document.getElementById('stats-paid-commission');
        affiliateReferralsList = document.getElementById('affiliate-referrals-list');

        adminPageLink = document.getElementById('admin-page-link');
        
        cartItemsContainer = document.getElementById('cart-items');
        totalPriceElement = document.getElementById('total-price');
        checkoutForm = document.getElementById('checkout-form');
        productsContainer = document.getElementById('products-container'); 
        placeOrderButton = document.getElementById('place-order-button');
        checkoutAuthMessage = document.getElementById('checkout-auth-message');

        // Language switcher (buttons)
        var langEnButton = document.getElementById('lang-en-button');
        var langEsButton = document.getElementById('lang-es-button');

        if (langEnButton) {
            langEnButton.addEventListener('click', function() {
                if (typeof i18n !== 'undefined' && typeof i18n.setLanguage === 'function') {
                    console.log('[UI] English button clicked');
                    i18n.setLanguage('en')
                        .then(function() {
                            console.log('[UI] i18n.setLanguage("en") promise RESOLVED. Current lang after set: ' + i18n.currentLanguage);
                            if (typeof updateActiveLanguageButton === 'function') {
                                updateActiveLanguageButton(i18n.currentLanguage);
                            } else {
                                console.error('[UI] updateActiveLanguageButton function not found after setting English.');
                            }
                        })
                        .catch(function(error) {
                            console.error('[UI] Error setting language to English:', error);
                        });
                }
            });
        }
        if (langEsButton) {
            langEsButton.addEventListener('click', function() {
                if (typeof i18n !== 'undefined' && typeof i18n.setLanguage === 'function') {
                    console.log('[UI] Spanish button clicked');
                    i18n.setLanguage('es')
                        .then(function() {
                            console.log('[UI] i18n.setLanguage("es") promise RESOLVED. Current lang after set: ' + i18n.currentLanguage);
                            if (typeof updateActiveLanguageButton === 'function') {
                                updateActiveLanguageButton(i18n.currentLanguage);
                            } else {
                                console.error('[UI] updateActiveLanguageButton function not found after setting Spanish.');
                            }
                        })
                        .catch(function(error) {
                            console.error('[UI] Error setting language to Spanish:', error);
                        });
                }
            });
        }
        // Set initial active language button state
        if (typeof updateActiveLanguageButton === 'function' && typeof i18n !== 'undefined' && i18n.currentLanguage) {
            console.log('[UI] Initial language UI update for:', i18n.currentLanguage);
            updateActiveLanguageButton(i18n.currentLanguage);
        } else {
            console.warn('[UI] Could not set initial language button state. i18n object:', typeof i18n, 'i18n.currentLanguage:', typeof i18n !== 'undefined' ? i18n.currentLanguage : 'i18n undefined');
        }


        // Attach event listeners
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegistration);
            console.log('[Register] Registration form event listener attached.');
        } else {
            console.error('[Register] Registration form element not found!');
        }

        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
            console.log('[Login] Login form submission event listener attached.');
        } else {
            console.error('[Login] Login form element not found!');
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
            console.log('[Logout] Logout button event listener attached.');
        } else {
            console.error('[Logout] Logout button element not found!');
        }

        if (checkoutForm) {
            checkoutForm.addEventListener('submit', function(event) { // Changed to non-async for ES5
                event.preventDefault();
                console.time('checkoutFormSubmitHandler');
                var name = document.getElementById('checkout-name').value;
                var email = document.getElementById('checkout-email').value;
                var phone = document.getElementById('checkout-phone').value;
                var customerDetails = { name: name, email: email, phone: phone };
                
                var cartItemsForBackend = cart.map(function(item) { return { productId: item.productId, quantity: item.quantity || 1 }; }); // Added quantity
                // var clientCalculatedTotalPrice = calculateTotalPrice(); // Not strictly needed by backend if it recalculates

                var orderData = { 
                    customerDetails: customerDetails, 
                    cartItems: cartItemsForBackend
                    // clientCalculatedTotalPrice: clientCalculatedTotalPrice // Optional
                };

                var tokenForOrder = localStorage.getItem('authToken');
                console.log('[Checkout] Token from localStorage for order:', tokenForOrder);
                console.log('[Checkout] Authorization Header that will be sent:', 'Bearer ' + tokenForOrder);

                var fetchOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + tokenForOrder
                    },
                    body: JSON.stringify(orderData)
                };
                
                var responseOkCheckout;

                fetch(API_BASE_URL + '/submit-order', fetchOptions)
                    .then(function(response) {
                        console.log('[Checkout] Raw response:', response);
                        responseOkCheckout = response.ok;
                        console.log('[Checkout] response.ok:', responseOkCheckout);
                        return response.json();
                    })
                    .then(function(result) {
                        console.log('[Checkout] Parsed data:', result);
                        if (responseOkCheckout) {
                            alert(i18n.getTranslation("alert_order_placed_success_dynamic", "Order placed successfully! Order ID: {orderId}. Total: {totalAmount}")
                                .replace("{orderId}", result.orderId)
                                .replace("{totalAmount}", formatCurrency(result.totalAmount)));
                            cart = [];
                            if(typeof renderCart === 'function') renderCart();
                            if(checkoutForm) checkoutForm.reset();
                        } else {
                            alert(i18n.getTranslation("alert_order_failed_reason", "Error placing order: {reason}")
                                .replace("{reason}", result.message || 'Unknown error'));
                        }
                    })
                    .catch(function(error) {
                        console.error('Checkout/Network error:', error);
                        alert(i18n.getTranslation("alert_order_error_generic", "Error submitting order. Check console."));
                    })
                    .finally(function() {
                        console.timeEnd('checkoutFormSubmitHandler');
                    });
            });
            console.log('[Checkout] Checkout form event listener attached.');
        } else {
            console.error('[Checkout] Checkout form element not found!');
        }

        // Initial UI setup based on auth state (e.g. from localStorage)
        // fetchProfile will call updateAuthStateUI internally
        if(typeof fetchProfile === 'function') fetchProfile(); else updateAuthStateUI(!!localStorage.getItem('authToken'));
        
        // Load products
        if(typeof fetchAndRenderProducts === 'function') fetchAndRenderProducts();

        // Capture affiliate ID from URL
        try { // Adding try-catch for URLSearchParams as it's ES6
            var urlParams = new URLSearchParams(window.location.search);
            var referringAffiliateIdFromUrl = urlParams.get('ref');
            if (referringAffiliateIdFromUrl) {
                sessionStorage.setItem('referringAffiliateId', referringAffiliateIdFromUrl);
                console.log('Captured referring affiliate ID:', referringAffiliateIdFromUrl);
            }
        } catch(e) {
            console.warn("URLSearchParams not supported or error accessing it. Affiliate ref via URL might not work.");
        }

        // Sidebar Toggle Logic
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', function() {
                console.log('[UI] Sidebar toggle clicked');
                sidebar.classList.toggle('hidden');
                document.body.classList.toggle('sidebar-content-shifted'); // Toggle body class
                var isSidebarNowHidden = sidebar.classList.contains('hidden');
                if (isSidebarNowHidden) {
                    sidebarToggle.classList.remove('sidebar-toggle-active');
                    sidebarToggle.setAttribute('aria-expanded', 'false');
                } else {
                    sidebarToggle.classList.add('sidebar-toggle-active');
                    sidebarToggle.setAttribute('aria-expanded', 'true');
                }
            });
            console.log('[UI] Sidebar toggle event listener attached.');
        } else {
            if (!sidebar) console.error('[UI] Sidebar element not found for toggle setup.');
            if (!sidebarToggle) console.error('[UI] Sidebar toggle button not found for toggle setup.');
        }

        // Settings Dropdown Logic
        var settingsButton = document.getElementById('header-settings-button');
        var settingsDropdown = document.getElementById('settings-dropdown');

        if (settingsButton && settingsDropdown) {
            settingsButton.addEventListener('click', function(event) {
                event.stopPropagation(); 
                var isHidden = settingsDropdown.classList.contains('hidden');
                
                // Minimal approach: always hide other dropdowns before showing current one
                // This can be expanded if more dropdowns are added.
                // For now, assuming only one dropdown might be open.
                
                if (isHidden) {
                    settingsDropdown.classList.remove('hidden');
                    var btnRect = settingsButton.getBoundingClientRect();
                    settingsDropdown.style.top = (btnRect.bottom + window.scrollY + 5) + 'px';
                    
                    // Attempt to position right-aligned first
                    settingsDropdown.style.left = 'auto'; // Reset left
                    settingsDropdown.style.right = (window.innerWidth - btnRect.right - window.scrollX) + 'px';
                    
                    // Check if it overflows on the left
                    var dropdownRect = settingsDropdown.getBoundingClientRect();
                    if (dropdownRect.left < 0) {
                        settingsDropdown.style.right = 'auto'; // Reset right
                        settingsDropdown.style.left = (btnRect.left + window.scrollX) + 'px';
                    }

                } else {
                    settingsDropdown.classList.add('hidden');
                }
            });

            document.addEventListener('click', function(event) {
                if (!settingsDropdown.classList.contains('hidden') && 
                    !settingsDropdown.contains(event.target) && 
                    event.target !== settingsButton && 
                    !settingsButton.contains(event.target)) {
                    settingsDropdown.classList.add('hidden');
                }
            });
        } else {
            if (!settingsButton) console.error('[UI] Settings button not found.');
            if (!settingsDropdown) console.error('[UI] Settings dropdown not found.');
        }

        // Theme Switcher Logic
        var lightThemeButton = document.getElementById('theme-light-button');
        var darkThemeButton = document.getElementById('theme-dark-button');
        var bodyElement = document.body;

        function applyTheme(themeName) {
            var logoImage = document.getElementById('site-logo'); // Get logo element

            if (themeName === 'light') {
                bodyElement.classList.add('light-theme');
                if (lightThemeButton) lightThemeButton.classList.add('active');
                if (darkThemeButton) darkThemeButton.classList.remove('active');
                if (logoImage) {
                    logoImage.src = 'logo1.png';
                }
            } else { // Default to dark
                bodyElement.classList.remove('light-theme');
                if (darkThemeButton) darkThemeButton.classList.add('active');
                if (lightThemeButton) lightThemeButton.classList.remove('active');
                if (logoImage) {
                    logoImage.src = 'logo.png';
                }
            }
            try { 
                localStorage.setItem('selectedTheme', themeName);
            } catch (e) {
                console.warn("Could not save theme to localStorage:", e);
            }
            console.log('Theme applied: ' + themeName + '; Logo src: ' + (logoImage && logoImage.src ? logoImage.src : 'logo element not found or src not set'));
        }

        if (lightThemeButton && darkThemeButton) {
            lightThemeButton.addEventListener('click', function() {
                applyTheme('light');
            });

            darkThemeButton.addEventListener('click', function() {
                applyTheme('dark');
            });

            var savedTheme = null;
            try {
                savedTheme = localStorage.getItem('selectedTheme');
            } catch (e) {
                console.warn("Could not retrieve theme from localStorage:", e);
            }

            if (savedTheme) {
                applyTheme(savedTheme);
            } else {
                // Check for prefers-color-scheme if no theme is saved
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                    applyTheme('light');
                } else {
                    applyTheme('dark'); // Default theme
                }
            }
        } else {
            if(!lightThemeButton) console.error("Light theme button not found");
            if(!darkThemeButton) console.error("Dark theme button not found");
        }

        // Avatar Dropdown Logic
        var headerAvatarButton = document.getElementById('header-avatar-button');
        var avatarDropdown = document.getElementById('avatar-dropdown');

        if (headerAvatarButton && avatarDropdown) {
            headerAvatarButton.addEventListener('click', function(event) {
                event.stopPropagation();
                var isHidden = avatarDropdown.classList.contains('hidden');

                // Hide settings dropdown if open
                var settingsDropdown = document.getElementById('settings-dropdown');
                if (settingsDropdown && !settingsDropdown.classList.contains('hidden')) {
                    settingsDropdown.classList.add('hidden');
                }
                
                if (isHidden) {
                    // Populate/Update Dynamic Content
                    var userNameElement = avatarDropdown.querySelector('#avatar-dropdown-username');
                    if (userNameElement) {
                        userNameElement.textContent = localStorage.getItem('userName') || 'N/A';
                    }
                    var avatarImgElement = avatarDropdown.querySelector('#avatar-dropdown-user-image');
                    var userAvatarUrl = localStorage.getItem('userAvatarUrl');
                    if (avatarImgElement && userAvatarUrl) {
                        avatarImgElement.src = userAvatarUrl;
                    } else if (avatarImgElement) {
                        // Revert to default if no specific URL found or on error
                        avatarImgElement.src = 'https://netfly.s3.sa-east-1.amazonaws.com/u/demo/images/avatar/IM9pP2hNkPUkltS7MxSAazgDeHvcjPf0YqBzngHs.jpg'; // Default
                    }

                    var adminLinkContainer = document.getElementById('avatar-admin-panel-link-container');
                    if (adminLinkContainer) {
                        if (localStorage.getItem('isAdmin') === 'true') {
                            adminLinkContainer.classList.remove('hidden');
                        } else {
                            adminLinkContainer.classList.add('hidden');
                        }
                    }
                    
                    avatarDropdown.classList.remove('hidden');
                    var btnRect = headerAvatarButton.getBoundingClientRect();
                    avatarDropdown.style.top = (btnRect.bottom + window.scrollY + 5) + 'px';
                    avatarDropdown.style.left = 'auto'; 
                    avatarDropdown.style.right = (window.innerWidth - btnRect.right - window.scrollX) + 'px';
                    
                    var dropdownRect = avatarDropdown.getBoundingClientRect();
                    if (dropdownRect.left < 0) { 
                        avatarDropdown.style.right = 'auto'; 
                        avatarDropdown.style.left = (btnRect.left + window.scrollX) + 'px';
                    }
                } else {
                    avatarDropdown.classList.add('hidden');
                }
            });

            document.addEventListener('click', function(event) {
                if (avatarDropdown && !avatarDropdown.classList.contains('hidden') &&
                    !avatarDropdown.contains(event.target) &&
                    headerAvatarButton && !headerAvatarButton.contains(event.target)) {
                    avatarDropdown.classList.add('hidden');
                }
                 // Also close settings dropdown if clicking outside of it
                var settingsDropdown = document.getElementById('settings-dropdown');
                var settingsButton = document.getElementById('header-settings-button');
                if (settingsDropdown && !settingsDropdown.classList.contains('hidden') &&
                    !settingsDropdown.contains(event.target) &&
                    settingsButton && !settingsButton.contains(event.target)) {
                    settingsDropdown.classList.add('hidden');
                }
            });

            var nameUserArea = avatarDropdown.querySelector('#avatar-dropdown-username'); // Target h6 directly
            if (nameUserArea) {
                 // Could also target the parent div if that's the intended clickable area
                var clickableProfileArea = nameUserArea.closest('.MuiCardContent-root'); 
                if(clickableProfileArea) {
                    clickableProfileArea.style.cursor = 'pointer';
                    clickableProfileArea.addEventListener('click', function(e) {
                        // Prevent if click was on an interactive element within this area
                        if (e.target.closest('a, button')) return; 
                        window.location.hash = '#user-profile'; 
                        avatarDropdown.classList.add('hidden'); 
                    });
                }
            }
            
            var avatarLogoutButton = document.getElementById('avatar-logout-button');
            if (avatarLogoutButton) {
                avatarLogoutButton.addEventListener('click', function(event) {
                    event.preventDefault(); // It's an <a> tag
                    if (typeof handleLogout === 'function') {
                        handleLogout(); 
                    } else {
                        console.error('handleLogout function not found.');
                    }
                    avatarDropdown.classList.add('hidden'); 
                });
            }
        } else {
            if (!headerAvatarButton) console.error('[UI] Header Avatar Button not found.');
            if (!avatarDropdown) console.error('[UI] Avatar Dropdown element not found.');
        }
        
        // Avatar Dropdown TAB Logic (should be within the main if (headerAvatarButton && avatarDropdown) block or a similar check)
        if (avatarDropdown) { // Check if avatarDropdown was found
            var avatarTabButtons = avatarDropdown.querySelectorAll('.MuiTab-root[role="tab"]');
            var avatarTabPanels = avatarDropdown.querySelectorAll('[role="tabpanel"]');

            function handleAvatarTabClick(event) {
                var clickedTab = event.currentTarget;
                var targetPanelId = clickedTab.getAttribute('aria-controls');

                avatarTabButtons.forEach(function(tab) {
                    if (tab === clickedTab) {
                        tab.classList.add('Mui-selected');
                        tab.setAttribute('aria-selected', 'true');
                    } else {
                        tab.classList.remove('Mui-selected');
                        tab.setAttribute('aria-selected', 'false');
                    }
                });

                avatarTabPanels.forEach(function(panel) {
                    if (panel.id === targetPanelId) {
                        panel.classList.remove('hidden');
                    } else {
                        panel.classList.add('hidden');
                    }
                });
            }

            avatarTabButtons.forEach(function(tabButton) {
                tabButton.addEventListener('click', handleAvatarTabClick);
            });
            console.log('Avatar dropdown tabs initialized.');
        }


    }).catch(function(err) {
        console.error("Failed to initialize i18n. Page might not be translated or fully functional.", err);
        // Fallback UI update if i18n fails but other parts of DOMContentLoaded should try to run
        // Select essential elements for fallback if not already done
        if (!sidebar) sidebar = document.getElementById('sidebar');
        if (!sidebarToggle) sidebarToggle = document.getElementById('sidebar-toggle');
        // Note: other elements like userAuthSection etc. would also need to be selected here for a full fallback.
        // However, the primary concern here is i18n failing before DOM element selection.
        // The existing DOMContentLoaded structure selects elements *after* i18nPromise resolves.
        // If i18nPromise rejects, those selections won't happen unless duplicated in catch.
        // For now, just ensure updateAuthStateUI can be called.
        updateAuthStateUI(!!localStorage.getItem('authToken')); 
        if(typeof fetchAndRenderProducts === 'function') fetchAndRenderProducts();
    });
});

// Definition for updateActiveLanguageButton (if not already defined, ensure it is)
// This was part of plan step for language switcher active state
function updateActiveLanguageButton(currentLang) {
    console.time('updateActiveLanguageButton_DOM');
    var langEnBtn = document.getElementById('lang-en-button');
    var langEsBtn = document.getElementById('lang-es-button');

    // Also for admin page, if this script were shared (it's not, admin.js has its own)
    // var langEnBtnAdmin = document.getElementById('lang-en-button-admin'); 
    // var langEsBtnAdmin = document.getElementById('lang-es-button-admin');

    if (langEnBtn && langEsBtn) {
        if (currentLang === 'en') {
            langEnBtn.classList.add('active-lang-button');
            langEsBtn.classList.remove('active-lang-button');
        } else if (currentLang === 'es') {
            langEsBtn.classList.add('active-lang-button');
            langEnBtn.classList.remove('active-lang-button');
        } else {
            langEnBtn.classList.remove('active-lang-button');
            langEsBtn.classList.remove('active-lang-button');
        }
    }
    // Similar logic for admin buttons if they exist on this page
    console.timeEnd('updateActiveLanguageButton_DOM');
}
