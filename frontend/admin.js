document.addEventListener('DOMContentLoaded', async () => { // Make it async
    if (typeof i18n !== 'undefined' && typeof i18n.initializeI18n === 'function') {
        await i18n.initializeI18n(); // Await initialization
    } else {
        console.error("i18n module not loaded correctly for admin.js.");
    }

    const languageSelectAdmin = document.getElementById('language-select-admin'); // Select language dropdown for admin

    const adminEmailDisplay = document.getElementById('admin-email-display');
    const adminLogoutButton = document.getElementById('admin-logout-button');
    const addProductForm = document.getElementById('add-product-form-admin');
    const addProductMessage = document.getElementById('add-product-message-admin');

    // Sidebar elements
    var adminSidebar = document.getElementById('sidebar'); // Using var for wider scope if needed by other functions
    var adminSidebarToggle = document.getElementById('sidebar-toggle');

    const API_BASE_URL = 'http://localhost:3000/api'; // Ensure this matches your main script's base URL

    // Function to check admin status and initialize page
    async function initializeAdminPage() {
        const userSpecificHeaderButtonIds = [
            'header-credits-button',
            'header-tasks-button',
            'header-cart-button',
            'header-avatar-button'
        ];
        const token = localStorage.getItem('authToken');
        const isAdmin = localStorage.getItem('isAdmin') === 'true';

        if (!token || !isAdmin) {
            // If no token or isAdmin is not true, redirect to main page
            window.location.href = 'index.html';
            return; // Stop further execution
        }

        // Optionally, re-verify with backend, though isAdmin flag from login is a good start
        // For enhanced security, you might call /api/auth/profile here and check isAdmin from response
        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                // Use i18n for the error message if possible, though this error might occur before i18n is fully ready
                throw new Error(typeof i18n !== 'undefined' ? i18n.getTranslation("error_session_expired_or_invalid", "Session expired or invalid.") : 'Session expired or invalid.');
            }
            const profileData = await response.json();
            if (!profileData.isAdmin) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('isAdmin');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                window.location.href = 'index.html'; // Redirect if backend says not admin
                return;
            }
            // Populate admin user info
            if (adminEmailDisplay) {
                adminEmailDisplay.textContent = profileData.email || 'Admin';
            }
        } catch (error) {
            console.error('Admin auth check failed:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('userName');
            localStorage.removeItem('userEmail');
            window.location.href = 'index.html'; // Redirect on error
            return;
        }

        // If admin, setup event listeners
        if (adminLogoutButton) {
            adminLogoutButton.addEventListener('click', handleAdminLogout);
        }
        if (addProductForm) {
            addProductForm.addEventListener('submit', handleAddProduct);
        }

        // Sidebar Toggle Logic for Admin Page
        if (adminSidebarToggle && adminSidebar) {
            adminSidebarToggle.addEventListener('click', function() {
                console.log('[Admin UI] Sidebar toggle clicked');
                adminSidebar.classList.toggle('hidden');
                document.body.classList.toggle('sidebar-content-shifted'); // Toggle body class
                var isAdminSidebarNowHidden = adminSidebar.classList.contains('hidden');
                if (isAdminSidebarNowHidden) {
                    adminSidebarToggle.classList.remove('sidebar-toggle-active');
                    adminSidebarToggle.setAttribute('aria-expanded', 'false');
                } else {
                    adminSidebarToggle.classList.add('sidebar-toggle-active');
                    adminSidebarToggle.setAttribute('aria-expanded', 'true');
                }
            });
            console.log('[Admin UI] Sidebar toggle event listener attached.');
            
            // Initial sidebar state for admin page: Hidden by default
            if (adminSidebar) {
                adminSidebar.classList.add('hidden'); 
            }
            if (adminSidebarToggle) {
                adminSidebarToggle.classList.remove('hidden');      // Show the toggle button
                adminSidebarToggle.classList.remove('sidebar-toggle-active'); // Set to 'closed' icon state
                adminSidebarToggle.setAttribute('aria-expanded', 'false');
            }
            document.body.classList.remove('sidebar-content-shifted'); // Ensure content is NOT shifted initially
        } else {
            if (!adminSidebar) console.error('[Admin UI] Sidebar element not found for admin page.');
            if (!adminSidebarToggle) console.error('[Admin UI] Sidebar toggle button not found for admin page.');
        }

        // Show user-specific header buttons for admin
        userSpecificHeaderButtonIds.forEach(function(buttonId) {
            var button = document.getElementById(buttonId);
            if (button) {
                button.classList.remove('hidden');
            }
        });
    }

    // Handle "Add Product" form submission
    async function handleAddProduct(event) {
        event.preventDefault();
        if (!addProductMessage) return;
        addProductMessage.textContent = ''; 
        addProductMessage.style.color = 'inherit'; 

        const token = localStorage.getItem('authToken');
        if (!token) {
            addProductMessage.textContent = i18n.getTranslation("admin_auth_error_login_again", "Authentication error. Please log in again.");
            addProductMessage.style.color = 'red';
            return;
        }

        const name = document.getElementById('product-name-admin').value;
        const description = document.getElementById('product-description-admin').value;
        const price = document.getElementById('product-price-admin').value;
        const imageFile = document.getElementById('product-image-file-admin').files[0]; // Get the file
        const category = document.getElementById('product-category-admin').value;
        // Token already retrieved above

        if (!name || !price) {
            addProductMessage.textContent = i18n.getTranslation("admin_error_product_name_price_required", "Product Name and Price are required.");
            addProductMessage.style.color = 'red';
            return;
        }
        if (parseFloat(price) <= 0) {
            addProductMessage.textContent = i18n.getTranslation("admin_error_price_must_be_positive", "Price must be a positive number.");
            addProductMessage.style.color = 'red';
            return;
        }

        var formData = new FormData();
        formData.append('name', name);
        formData.append('description', description || ''); // Multer handles empty strings; backend converts to null if needed
        formData.append('price', parseFloat(price));
        formData.append('category', category || '');     // Multer handles empty strings

        if (imageFile) {
            formData.append('productImage', imageFile, imageFile.name);
            console.log('[Admin Add Product] Appending file to FormData:', imageFile.name);
        } else {
            console.log('[Admin Add Product] No image file selected for FormData.');
        }

        var fetchOptions = {
            method: 'POST',
            headers: {
                // 'Content-Type' is NOT set here; browser sets it for FormData
                'Authorization': 'Bearer ' + token
            },
            body: formData
        };

        console.log('[Admin Add Product] FormData content being sent:');
        for (var pair of formData.entries()) { 
            if (pair[1] instanceof File) {
                console.log('  ' + pair[0] + ': [File] ' + pair[1].name + ', size: ' + pair[1].size + ', type: ' + pair[1].type);
            } else {
                console.log('  ' + pair[0] + ': ' + pair[1]);
            }
        }

        try {
            // The fetch call now uses formData directly as the body
            const response = await fetch(API_BASE_URL + '/admin/products', fetchOptions);
            const result = await response.json();

            if (response.ok) {
                console.time('handleAddProduct_UIUpdate');
                addProductMessage.textContent = i18n.getTranslation("admin_text_product_added_success_dynamic", "Product '{productName}' (ID: {productId}) added successfully!")
                                                    .replace("{productName}", result.product.name)
                                                    .replace("{productId}", result.product.id);
                addProductMessage.style.color = 'green';
                if(addProductForm) addProductForm.reset();
                // No product list on admin page to refresh currently
                console.timeEnd('handleAddProduct_UIUpdate');
            } else {
                addProductMessage.textContent = i18n.getTranslation("admin_error_product_add_reason", "Error: {reason}")
                                                    .replace("{reason}", result.message || response.statusText);
                addProductMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Failed to add product:', error);
            addProductMessage.textContent = i18n.getTranslation("admin_error_failed_to_add_product_console", "Failed to add product. See console for details.");
            addProductMessage.style.color = 'red';
        }
    }

    // Handle Admin Logout
    function handleAdminLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('userName'); // Also clear other user-specific data
        localStorage.removeItem('userEmail');
        
        // Hide sidebar and toggle before redirecting
        if (adminSidebar) {
            adminSidebar.classList.add('hidden');
            document.body.classList.remove('sidebar-content-shifted'); // Unshift content
        }
        if (adminSidebarToggle) {
            adminSidebarToggle.classList.add('hidden');
            adminSidebarToggle.classList.remove('sidebar-toggle-active');
            adminSidebarToggle.setAttribute('aria-expanded', 'false');
        }
        
        // Hide user-specific header buttons on logout
        var userSpecificHeaderButtonIds = [ // Re-declare here or make it global to DOMContentLoaded
            'header-credits-button',
            'header-tasks-button',
            'header-cart-button',
            'header-avatar-button'
        ];
        userSpecificHeaderButtonIds.forEach(function(buttonId) {
            var button = document.getElementById(buttonId);
            if (button) {
                button.classList.add('hidden');
            }
        });

        // Redirect to main page or login page
        window.location.href = 'index.html';
    }

    // Initialize the admin page
    initializeAdminPage();

    // Event listener for language select on admin page
    if (languageSelectAdmin) {
        languageSelectAdmin.addEventListener('change', (event) => {
            if (typeof i18n !== 'undefined' && typeof i18n.setLanguage === 'function') {
                i18n.setLanguage(event.target.value);
            }
        });
        // Set initial value after i18n is initialized
        if (typeof i18n !== 'undefined') {
            languageSelectAdmin.value = i18n.currentLanguage;
        }
    }
});
