/*jshint esversion: 5 */ // Updated to ES5 for JSHint
console.log('DEBUG: i18n.js VERSION 3.0 - RAF_ES5_OPTIMIZED_LOGS');
// frontend/i18n.js

var i18n = {
    currentLanguage: 'en', // Default language
    translations: {},      // To store loaded translations

    // ES5 compatible async-like pattern: functions return promises
    loadLanguage: function(lang) {
        var _this = this; // Preserve 'this' context for promise callbacks
        return fetch('locales/' + lang + '.json')
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Failed to load language file: ' + lang + '.json (' + response.status + ')');
                }
                return response.json();
            })
            .then(function(jsonData) {
                // console.log('[i18n] Successfully fetched and parsed JSON for lang:', lang, jsonData); 
                _this.translations[lang] = jsonData;
                console.log('Loaded translations for ' + lang + '.'); // Simplified
                return _this.translations[lang]; 
            })
            .catch(function(error) {
                // console.log('[i18n] loadLanguage: In catch for lang:', lang); 
                console.error('Error loading language \'' + lang + '\':', error);
                if (lang !== 'en' && !_this.translations.en) {
                    // console.log('[i18n] loadLanguage: Fallback to English triggered for lang:', lang);
                    console.log("Falling back to English..."); // Keep this high-level info
                    return _this.loadLanguage('en'); 
                } else if (lang !== 'en' && _this.translations.en) {
                    // console.log('[i18n] loadLanguage: Fallback to English triggered for lang:', lang); 
                    return _this.translations.en; 
                }
                // console.log('[i18n] loadLanguage: Returning empty object for lang:', lang); 
                return {}; 
            });
    },

    applyTranslations: function() {
        var _this = this; 
        console.log('[i18n] applyTranslations: Called for language:', this.currentLanguage);
        var langTranslations = this.translations[this.currentLanguage];
        console.log('[i18n] applyTranslations: Translations object for current language:', langTranslations);

        if (!langTranslations) {
            console.warn('[i18n] applyTranslations: No translations found for language: ' + this.currentLanguage);
            return;
        }

        var elementsToTranslate = document.querySelectorAll('[data-i18n-key]');
        var updatesBatch = []; 

        Array.prototype.forEach.call(elementsToTranslate, function(element) {
            var key = element.getAttribute('data-i18n-key');
            // console.log('[i18n] applyTranslations: Processing element:', element, 'with key:', key); 
            
            if (langTranslations[key]) {
                var translationValue = langTranslations[key];
                // console.log('[i18n] applyTranslations: Found translation for key \'' + key + '\':', translationValue); 

                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    if (element.placeholder && (element.type === 'text' || element.type === 'email' || element.type === 'password' || element.type === 'url' || element.type === 'tel' || element.type === 'number')) {
                        updatesBatch.push({ element: element, text: translationValue, type: 'placeholder' });
                    } else if (element.type === 'submit' || element.type === 'button') {
                        updatesBatch.push({ element: element, text: translationValue, type: 'value' });
                    }
                } else {
                    updatesBatch.push({ element: element, text: translationValue, type: 'textContent' });
                }
            } else {
                console.warn('[i18n] applyTranslations: Missing translation for key: \'' + key + '\' in language \'' + _this.currentLanguage + '\'');
            }
        });

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function() {
                console.time('applyTranslations_rAF_DOMUpdates');
                console.log('[i18n] applyTranslations: Applying DOM updates in rAF callback for ' + updatesBatch.length + ' elements.');
                updatesBatch.forEach(function(update) {
                    if (update.type === 'textContent') {
                        update.element.textContent = update.text;
                    } else if (update.type === 'placeholder') {
                        update.element.placeholder = update.text;
                    } else if (update.type === 'value') {
                        update.element.value = update.text;
                    }
                });
                if (langTranslations.site_title_document) {
                    // console.log('[i18n] applyTranslations: Setting document.title (site) to:', langTranslations.site_title_document); 
                    document.title = langTranslations.site_title_document;
                }
                if (langTranslations.admin_page_title && document.body.id === 'admin-page') {
                    // console.log('[i18n] applyTranslations: Setting document.title (admin) to:', langTranslations.admin_page_title); 
                     document.title = langTranslations.admin_page_title;
                }
                console.timeEnd('applyTranslations_rAF_DOMUpdates');
                console.log('[i18n] applyTranslations: DOM updates complete.');
            });
        } else {
            console.time('applyTranslations_Direct_DOMUpdates');
            console.log('[i18n] applyTranslations: requestAnimationFrame not available, applying DOM updates directly for ' + updatesBatch.length + ' elements.');
            updatesBatch.forEach(function(update) {
                if (update.type === 'textContent') {
                    update.element.textContent = update.text;
                } else if (update.type === 'placeholder') {
                    update.element.placeholder = update.text;
                } else if (update.type === 'value') {
                    update.element.value = update.text;
                }
            });
            if (langTranslations.site_title_document) { document.title = langTranslations.site_title_document; }
            if (langTranslations.admin_page_title && document.body.id === 'admin-page') { document.title = langTranslations.admin_page_title; }
            console.timeEnd('applyTranslations_Direct_DOMUpdates');
        }
    },

    setLanguage: function(lang) {
        // console.log('[i18n] setLanguage: Called with lang:', lang); 
        var _this = this;
        var promise;

        if (!this.translations[lang]) {
            // console.log('[i18n] setLanguage: Language ' + lang + ' not loaded, fetching.'); 
            promise = this.loadLanguage(lang); 
        } else {
            // console.log('[i18n] setLanguage: Language ' + lang + ' already loaded.'); 
            promise = Promise.resolve(this.translations[lang]); 
        }

        return promise.then(function() { 
            // console.log('[i18n] setLanguage: loadLanguage promise resolved for lang:', lang, 'Now setting currentLanguage and applying translations.');
            _this.currentLanguage = lang;
            // console.log('[i18n] setLanguage: currentLanguage set to:', _this.currentLanguage);
            localStorage.setItem('preferredLanguage', lang);
            // console.log('[i18n] setLanguage: preferredLanguage saved to localStorage.');
            // console.log('[i18n] setLanguage: About to call applyTranslations for lang:', _this.currentLanguage);
            _this.applyTranslations();
            return Promise.resolve(); 
        }).catch(function(error) {
            console.error("Failed to set language " + lang + " due to loading error:", error); // Keep
            return Promise.reject(error); 
        });
    },

    getTranslation: function(key, fallback) {
        // console.log('[i18n] getTranslation: Called for key:', key, 'Current lang:', this.currentLanguage); 
        var actualFallback = (typeof fallback !== 'undefined') ? fallback : ''; 
        var langTranslations = this.translations[this.currentLanguage];
        
        if (langTranslations && langTranslations[key]) {
            // console.log('[i18n] getTranslation: Found value for key \'' + key + '\':', langTranslations[key]); 
            return langTranslations[key];
        }
        // console.warn('[i18n] getTranslation: Using fallback for key: \'' + key + '\''); 
        console.warn('Missing translation for key (getTranslation): \'' + key + '\' in language \'' + this.currentLanguage + '\''); // Keep
        return actualFallback || key;
    },

    initializeI18n: function() {
        // console.log('[i18n] initializeI18n: Initializing...');
        var preferredLanguage = localStorage.getItem('preferredLanguage') || 'en';
        // console.log('[i18n] initializeI18n: Preferred language from localStorage (or default):', preferredLanguage);
        // console.log('[i18n] initializeI18n: About to call setLanguage with:', preferredLanguage);
        
        return this.setLanguage(preferredLanguage).then(function() {
            console.log('[i18n] initializeI18n: Initialization complete for language:', i18n.currentLanguage); // Keep this high-level one
        }).catch(function(error) {
            console.error("[i18n] initializeI18n: Initialization failed.", error); // Keep
        });
    }
};

// document.addEventListener('DOMContentLoaded', function() { i18n.initializeI18n(); });
