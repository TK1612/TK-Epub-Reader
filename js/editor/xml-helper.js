/**
 * Editor XML Helper Module
 * Handles XML parsing, OPF path finding, and serialization
 * Reduces code duplication across editor functions
 */

/**
 * Find the OPF file path in the EPUB
 * @returns {string|undefined} Path to the OPF file, or undefined if not found
 */
window.findOpfPath = function() {
    if (!window.activeZipEditor || !window.activeZipEditor.files) return undefined;
    return Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.opf'));
};

/**
 * Find the NCX file path in the EPUB
 * @returns {string|undefined} Path to the NCX file, or undefined if not found
 */
window.findNcxPath = function() {
    if (!window.activeZipEditor || !window.activeZipEditor.files) return undefined;
    return Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.ncx'));
};

/**
 * Parse an XML file from the EPUB
 * @param {string} path - Path to the XML file in the ZIP
 * @returns {Document} Parsed XML document
 */
window.parseXmlFile = async function(path) {
    if (!window.activeZipEditor || !path) return null;
    const content = await window.activeZipEditor.file(path).async("string");
    return new DOMParser().parseFromString(content, "application/xml");
};

/**
 * Serialize an XML document and save it to the EPUB
 * @param {string} path - Path to save the XML file
 * @param {Document} xmlDoc - The XML document to serialize
 */
window.serializeAndSaveXml = function(path, xmlDoc) {
    if (!window.activeZipEditor || !path || !xmlDoc) return;
    window.activeZipEditor.file(path, new XMLSerializer().serializeToString(xmlDoc));
};

/**
 * Get text content from XML elements with fallback
 * @param {Document} xmlDoc - The XML document
 * @param {string} tagName - The tag name to search for
 * @param {string} alternateTagName - Alternate tag name (optional)
 * @returns {string} The text content, or empty string if not found
 */
window.getXmlTextContent = function(xmlDoc, tagName, alternateTagName = null) {
    if (!xmlDoc) return "";
    const node = xmlDoc.getElementsByTagName(tagName)[0] || 
                 (alternateTagName && xmlDoc.getElementsByTagName(alternateTagName)[0]);
    return node ? node.textContent : "";
};
