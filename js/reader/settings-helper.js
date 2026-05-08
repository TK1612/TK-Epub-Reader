/**
 * Settings Helper Module
 * Shared settings logic for both EPUB.js and Foliate.js engines.
 */

/**
 * Load reader settings from localStorage and apply them to DOM elements
 */
window.loadReaderSettings = function() {
    try {
        const saved = JSON.parse(localStorage.getItem('reader-settings') || '{}');
        
        // Apply theme
        const themeSelect = document.getElementById('set-reader-theme');
        if (themeSelect && saved.theme) themeSelect.value = saved.theme;
        
        // Apply font size
        const fontSlider = document.getElementById('set-font');
        const fontValue = document.getElementById('val-font');
        if (fontSlider && saved.fontSize) {
            fontSlider.value = saved.fontSize;
            if (fontValue) fontValue.innerText = saved.fontSize + 'px';
        }
        
        // Apply line height
        const lineSlider = document.getElementById('set-line');
        const lineValue = document.getElementById('val-line');
        if (lineSlider && saved.lineHeight) {
            lineSlider.value = saved.lineHeight;
            if (lineValue) lineValue.innerText = saved.lineHeight;
        }
        
        // Apply paragraph spacing
        const paraSlider = document.getElementById('set-para-spacing');
        const paraValue = document.getElementById('val-para-spacing');
        if (paraSlider && saved.paraSpacing !== undefined) {
            paraSlider.value = saved.paraSpacing;
            if (paraValue) paraValue.innerText = saved.paraSpacing + 'em';
        }
        
        // Apply indent
        const indentSlider = document.getElementById('set-indent');
        const indentValue = document.getElementById('val-indent');
        if (indentSlider && saved.indent !== undefined) {
            indentSlider.value = saved.indent;
            if (indentValue) indentValue.innerText = saved.indent + 'em';
        }
        
        // Apply font family
        const fontFamilySelect = document.getElementById('set-font-family');
        if (fontFamilySelect && saved.fontFamily) fontFamilySelect.value = saved.fontFamily;
        
        // Apply read mode
        const readModeSelect = document.getElementById('set-read-mode');
        if (readModeSelect && saved.readMode) readModeSelect.value = saved.readMode;
        
        // Apply pin taskbar
        const pinTaskbarCheckbox = document.getElementById('set-pin-taskbar');
        if (pinTaskbarCheckbox) pinTaskbarCheckbox.checked = saved.pinTaskbar !== false;
        
        // Apply show floating button
        const showFloatBtnCheckbox = document.getElementById('set-show-float-btn');
        if (showFloatBtnCheckbox) showFloatBtnCheckbox.checked = saved.showFloatBtn !== false;
        
        if (saved.textAlign) {
            document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
            const alignBtn = document.querySelector(`.segment-btn[data-align="${saved.textAlign}"]`);
            if (alignBtn) {
                alignBtn.classList.add('active');
            } else {
                // Fallback to ID-based selection
                const alignBtnById = document.getElementById('align-' + saved.textAlign);
                if (alignBtnById) alignBtnById.classList.add('active');
            }
        }
        
        return saved;
    } catch (e) {
        console.error('Error loading reader settings:', e);
        return {};
    }
};

/**
 * Save current reader settings from DOM elements to localStorage
 */
window.saveReaderSettings = function() {
    try {
        // Get text align from active segment button's data-align attribute
        const activeAlignBtn = document.querySelector('.segment-btn.active');
        const textAlign = activeAlignBtn?.dataset?.align || 'left';
        
        const settings = {
            theme: document.getElementById('set-reader-theme')?.value || 'dark',
            fontSize: document.getElementById('set-font')?.value || '18',
            lineHeight: document.getElementById('set-line')?.value || '1.5',
            paraSpacing: document.getElementById('set-para-spacing')?.value || '1',
            indent: document.getElementById('set-indent')?.value || '0',
            fontFamily: document.getElementById('set-font-family')?.value || 'Inter, sans-serif',
            textAlign: textAlign,
            readMode: document.getElementById('set-read-mode')?.value || 'paginated',
            pinTaskbar: document.getElementById('set-pin-taskbar')?.checked !== false,
            showFloatBtn: document.getElementById('set-show-float-btn')?.checked !== false
        };
        
        localStorage.setItem('reader-settings', JSON.stringify(settings));
    } catch (e) {
        console.error('Error saving reader settings:', e);
    }
};

/**
 * Get background and text colors based on theme
 */
window.getThemeColors = function(theme) {
    let bgColor, color;
    
    switch (theme) {
        case 'black':
            bgColor = '#000000';
            color = '#e5e7eb';
            break;
        case 'dark':
            bgColor = '#18181b';
            color = '#e5e7eb';
            break;
        case 'light':
            bgColor = '#ffffff';
            color = '#1f2937';
            break;
        case 'paper':
            bgColor = '#f5f0e1';
            color = '#3a2a1a';
            break;
        case 'blue':
            bgColor = '#e3f2fd';
            color = '#1a237e';
            break;
        default:
            bgColor = '#18181b';
            color = '#e5e7eb';
    }
    
    return { bgColor, color };
};
