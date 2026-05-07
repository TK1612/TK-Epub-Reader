# Modern Web EPUB Reader & Editor 📖✨

A sleek, web-based EPUB reader and full-fledged IDE featuring a modern Glassmorphism UI, continuous scroll support, and robust local library management. Built entirely with frontend technologies, this reader processes, edits, and stores your novels locally in your browser—meaning absolutely no backend servers or databases are required!

![649178036_950205537550061_276526426078080711_n](https://github.com/user-attachments/assets/6f7abce4-5bd4-434f-8828-5a20f86740b7)

**🌐 Access the Live App Here:** [TK-Epub-Reader](https://tk1612.github.io/TK-Epub-Reader/)

## 🌟 Reader Features

* **Offline Local Library:** Upload `.epub` files directly from your device. Books are stored safely in your browser's IndexedDB using `localforage` so they remain available even after you close the tab.
* **Modern Glassmorphism UI:** A beautiful, frosted-glass interface with fully supported **Light** and **Dark modes**.
* **Supporting both Epub.js and Foliate.js.**
* **Advanced Reading Modes:**
    * *Continuous Scroll:* Read seamlessly with custom-injected visual gaps between chapters.
    * *Single Chapter Scroll:* Traditional vertical scrolling chapter-by-chapter.
    * *Paginated:* Swipe or click to turn pages like a real physical book.
* **Immersive Background Themes:** Instantly switch between Black, White, Paper (Sepia), and Light Blue. Features a custom "Master CSS" injection engine that brute-forces out ugly, hardcoded publisher background colors so your theme is always perfectly applied.
* **Deep Customization:** Adjust font size, line height, font family (including **KoPub Batang** for Korean novels), text alignment, and text colors on the fly.
* **Table of Contents & Bookmarks:** Auto-highlighting TOC so you always know exactly what chapter you're on, plus manual and auto-bookmarking capabilities.
* **Mobile Responsive:** Fully optimized for mobile devices with touch/swipe controls and an adaptive, screen-friendly layout.

## 🛠️ Built-in EPUB Editor (Calibre Alternative)

Transform the reader into a professional EPUB IDE with a single click. The editor "lazy loads" your book into browser memory, allowing you to edit the raw source code without desktop software.

* **CodeMirror Integration:** Full syntax highlighting for HTML, CSS, and XML files, complete with a visual image viewer.
* **Typo & OCR Scanner:** Automatically scans the entire book to extract rare words and potential OCR typos. Fully supports English, Korean (Hangul), Japanese (Kana), and Chinese (Hanzi/Kanji).
* **Global Search & Regex:** Search and replace strings or Regex patterns across the entire novel simultaneously.
* **TOC & Metadata Management:** Auto-generate your Table of Contents from heading tags (`<h1>`, `<h2>`) and edit book metadata (Title/Author) via a clean UI.
* **Asset Management:** Import images, stylesheets, or create new blank chapters directly into the EPUB. The editor automatically updates the `.opf` manifest for you.
* **EPUB Debugger:** Scan the book's manifest against the actual ZIP contents to instantly detect broken links and missing files.
* **EPUB Base64 String Cleaner**
* **Revert Save:** Made a mistake? Instantly revert the book back to its original state from when you opened the editor.

## 💻 Tech Stack

* **HTML5 / CSS3 / Vanilla JavaScript**
* **[ePub.js](https://github.com/futurepress/epub.js/)**
* **[foliate.js](https://github.com/johnfactotum/foliate-js)**
* **[JSZip](https://stuk.github.io/jszip/)**
* **[localForage](https://localforage.github.io/localForage/)**
* **[CodeMirror (v5)](https://codemirror.net/5/)**
* **[Phosphor Icons](https://phosphoricons.com/)**

## 📝 Usage Notes

* **Deleting Books:** Click the red "X" icon in the top right of the Library view to toggle Delete Mode.
* **Dynamic Taskbar:** The bottom reader taskbar auto-hides when you scroll down to give you maximum screen space. You can permanently pin it via the Settings modal.
* **Format Resilience:** The reader actively recalculates your location and protects your progress data against ePub.js race conditions, ensuring you never accidentally lose your spot when switching modes or closing the app too quickly.
* **Editor Memory Management:** The Editor workspace utilizes "lazy loading." It only unzips the EPUB archive into your browser's RAM when you explicitly open the "Edit Book" page, ensuring the main reading experience remains lightning-fast and lightweight.

---
*Gosh I hate myself save me.* 🥂
