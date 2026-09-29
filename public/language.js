(function () {
    const STORAGE_KEY = 'preferred-language';
    const PAGE_LANGUAGE = 'en';
    const LANGUAGES = [
        { code: 'en', label: 'English' },
        { code: 'pt', label: 'Portuguese' },
        { code: 'cs', label: 'Czech' },
        { code: 'da', label: 'Danish' },
        { code: 'de', label: 'German' },
        { code: 'es', label: 'Spanish' },
        { code: 'fr', label: 'French' },
        { code: 'it', label: 'Italian' },
        { code: 'id', label: 'Indonesian' },
        { code: 'ms', label: 'Malay' },
        { code: 'nl', label: 'Dutch' },
        { code: 'no', label: 'Norwegian' },
        { code: 'pl', label: 'Polish' },
        { code: 'fi', label: 'Finnish' },
        { code: 'sv', label: 'Swedish' },
        { code: 'vi', label: 'Vietnamese' },
        { code: 'tr', label: 'Turkish' },
        { code: 'el', label: 'Greek' },
        { code: 'ru', label: 'Russian' },
        { code: 'uk', label: 'Ukrainian' },
        { code: 'he', label: 'Hebrew' },
        { code: 'ar', label: 'Arabic' },
        { code: 'hi', label: 'Hindi' },
        { code: 'th', label: 'Thai' },
        { code: 'ko', label: 'Korean' },
        { code: 'zh-CN', label: 'Chinese (Simplified)' },
        { code: 'zh-TW', label: 'Chinese (Traditional)' },
        { code: 'ja', label: 'Japanese' }
    ];

    const getCookieValue = (name) => {
        const part = document.cookie
            .split('; ')
            .find((item) => item.startsWith(name + '='));
        return part ? decodeURIComponent(part.split('=')[1]) : null;
    };

    const setTranslationCookie = (languageCode) => {
        const value = `/${PAGE_LANGUAGE}/${languageCode}`;
        document.cookie = `googtrans=${value};path=/`;
        document.cookie = `googtrans=${value};domain=${window.location.hostname};path=/`;
    };

    const applySavedLanguageEarly = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && saved !== PAGE_LANGUAGE) {
            setTranslationCookie(saved);
        }
    };

    const createUi = () => {
        if (document.getElementById('language-switcher-root')) return;

        const style = document.createElement('style');
        style.textContent = `
            #language-switcher-root {
                position: fixed;
                right: 16px;
                bottom: 16px;
                z-index: 99999;
                font-family: Arial, sans-serif;
            }
            #language-open-btn {
                border: none;
                border-radius: 999px;
                background: #1d4ed8;
                color: #fff;
                padding: 10px 14px;
                font-size: 14px;
                font-weight: 600;
                box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
                cursor: pointer;
            }
            #language-modal {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 100000;
                background: rgba(0, 0, 0, 0.45);
                align-items: center;
                justify-content: center;
                padding: 16px;
            }
            #language-modal.open {
                display: flex;
            }
            #language-panel {
                width: min(760px, 100%);
                background: #fff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
            }
            #language-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 18px 20px;
                border-bottom: 1px solid #e5e7eb;
            }
            #language-panel-title {
                margin: 0;
                font-size: 20px;
                color: #111827;
                font-weight: 600;
            }
            #language-close-btn {
                border: none;
                background: transparent;
                color: #6b7280;
                font-size: 28px;
                line-height: 1;
                cursor: pointer;
                padding: 0;
            }
            #language-list {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0;
                padding: 12px 16px 16px;
                max-height: min(64vh, 560px);
                overflow-y: auto;
            }
            .language-item {
                text-align: left;
                border: none;
                background: transparent;
                color: #1f2937;
                border-radius: 8px;
                padding: 10px 12px;
                font-size: 16px;
                cursor: pointer;
            }
            .language-item:hover {
                background: #f3f4f6;
            }
            .language-item.active {
                background: #e5efff;
                color: #1d4ed8;
                font-weight: 600;
            }
            #google_translate_hidden,
            .goog-te-banner-frame.skiptranslate,
            .goog-te-gadget,
            .goog-logo-link {
                display: none !important;
            }
            body {
                top: 0 !important;
            }
            @media (max-width: 640px) {
                #language-list {
                    grid-template-columns: repeat(1, minmax(0, 1fr));
                }
                #language-open-btn {
                    padding: 9px 12px;
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);

        const root = document.createElement('div');
        root.id = 'language-switcher-root';
        root.innerHTML = `
            <button id="language-open-btn" type="button">Language</button>
        `;

        const modal = document.createElement('div');
        modal.id = 'language-modal';
        modal.innerHTML = `
            <div id="language-panel" role="dialog" aria-modal="true" aria-label="Select language">
                <div id="language-panel-header">
                    <h3 id="language-panel-title">Select Your Language</h3>
                    <button id="language-close-btn" type="button" aria-label="Close language dialog">&times;</button>
                </div>
                <div id="language-list"></div>
            </div>
        `;

        const hiddenTranslateContainer = document.createElement('div');
        hiddenTranslateContainer.id = 'google_translate_hidden';

        document.body.appendChild(root);
        document.body.appendChild(modal);
        document.body.appendChild(hiddenTranslateContainer);

        const openBtn = document.getElementById('language-open-btn');
        const closeBtn = document.getElementById('language-close-btn');
        const listEl = document.getElementById('language-list');

        const getCurrentLanguage = () => {
            const fromStorage = localStorage.getItem(STORAGE_KEY);
            if (fromStorage) return fromStorage;

            const fromCookie = getCookieValue('googtrans');
            if (!fromCookie) return PAGE_LANGUAGE;

            const segments = fromCookie.split('/').filter(Boolean);
            return segments[1] || PAGE_LANGUAGE;
        };

        const currentLanguage = getCurrentLanguage();

        LANGUAGES.forEach((lang) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'language-item';
            if (lang.code === currentLanguage) {
                item.classList.add('active');
            }
            item.textContent = lang.label;
            item.dataset.lang = lang.code;
            item.addEventListener('click', () => {
                localStorage.setItem(STORAGE_KEY, lang.code);
                setTranslationCookie(lang.code);
                window.location.reload();
            });
            listEl.appendChild(item);
        });

        openBtn.addEventListener('click', () => {
            modal.classList.add('open');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('open');
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('open');
            }
        });
    };

    const loadGoogleTranslate = () => {
        if (document.getElementById('google-translate-script')) return;

        window.googleTranslateElementInit = function () {
            if (!(window.google && window.google.translate)) return;
            new window.google.translate.TranslateElement(
                {
                    pageLanguage: PAGE_LANGUAGE,
                    autoDisplay: false
                },
                'google_translate_hidden'
            );
        };

        const script = document.createElement('script');
        script.id = 'google-translate-script';
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        document.body.appendChild(script);
    };

    applySavedLanguageEarly();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createUi();
            loadGoogleTranslate();
        });
    } else {
        createUi();
        loadGoogleTranslate();
    }
})();
