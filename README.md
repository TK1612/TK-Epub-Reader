# Modern Web EPUB Reader 📖✨

A sleek, web-based EPUB reader featuring a modern Glassmorphism UI, continuous scroll support, and robust local library management. Built entirely with frontend technologies, this reader processes and stores your novels locally in your browser—meaning no backend servers or databases are required!

![649178036_950205537550061_276526426078080711_n](https://github.com/user-attachments/assets/6f7abce4-5bd4-434f-8828-5a20f86740b7)

**🌐 Access the Live Reader Here:** [TK-Epub-Reader](https://tk1612.github.io/TK-Epub-Reader/)

## 🌟 Features

* **Offline Local Library:** Upload `.epub` files directly from your device. Books are stored safely in your browser's IndexedDB using `localforage` so they remain available even after you close the tab.
* **Modern Glassmorphism UI:** A beautiful, frosted-glass interface with fully supported **Light** and **Dark modes**.
* **Smart Progress Tracking:** Automatically calculates your reading percentage (based on chapter/spine index) and displays a sleek progress bar on your library cards. 
* **Advanced Reading Modes:** * *Continuous Scroll:* Read seamlessly with custom-injected visual gaps between chapters.
    * *Single Chapter Scroll:* Traditional vertical scrolling chapter-by-chapter.
    * *Paginated:* Swipe or click to turn pages like a real book.
* **Deep Customization:** Adjust font size, line height, font family, and text colors on the fly.
* **Table of Contents & Bookmarks:** Auto-highlighting TOC so you always know exactly what chapter you're on, plus manual and auto-bookmarking capabilities.
* **Powerful Tools:** Features a global search to find phrases across the entire novel, and a built-in HTML editor to tweak page content using Regex.
* **Mobile Responsive:** Fully optimized for mobile devices with touch/swipe controls and an adaptive, screen-friendly layout.

## 🛠️ Tech Stack

* **HTML5 / CSS3 / Vanilla JavaScript**
* **[ePub.js](https://github.com/futurepress/epub.js/)** - Core engine for parsing and rendering EPUB files.
* **[localForage](https://localforage.github.io/localForage/)** - Offline storage wrapper for IndexedDB.
* **[JSZip](https://stuk.github.io/jszip/)** - Required dependency for extracting EPUB archives.
* **[Phosphor Icons](https://phosphoricons.com/)** - Clean, consistent iconography used throughout the app.

## 📝 Usage Notes
* Deleting Books: Click the red "X" icon in the top right of the Library view to toggle Delete Mode.
* Taskbar: The bottom reader taskbar auto-hides when you scroll down to give you more screen space. You can pin it permanently via the Settings modal.
* Progress Math: Progress percentages are calculated precisely based on your current chapter against the total chapters in the book's spine, preventing progress tracking bugs on heavily formatted novels.
* Super clean UI that i learned myself (fuck me).
