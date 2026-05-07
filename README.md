<div align="center">
  <table>
    <tr>
      <td><h1 style="margin:0;">TK EPUB Reader & Editor 📖✨</h1></td>
      <td><img src="https://github.com/user-attachments/assets/6f7abce4-5bd4-434f-8828-5a20f86740b7" alt="TK EPUB Reader" height="100"></td>
    </tr>
  </table>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-success?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/Version-1.1.8-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Deployed-GitHub%20Pages-green?style=flat-square" alt="Deployed">
  <img src="https://img.shields.io/badge/Built%20With-Vanilla%20JS-yellow?style=flat-square" alt="Vanilla JS">
</p>

<p align="center">
  A modern, feature-rich web-based EPUB reader and editor with a sleek Glassmorphism UI.<br>
  No backend required—everything runs locally in your browser!
</p>

<p align="center">
  <a href="https://tk1612.github.io/TK-Epub-Reader/"><strong>🌐 Live Demo</strong></a>
</p>

---

## ✨ Key Features

### 📚 Reader Features
- **Offline Local Library** — Upload and store EPUB files directly in your browser using IndexedDB (`localforage`). Books persist between sessions and survive browser restarts.
- **Dual Engine Support** — Choose between **Epub.js** and **Foliate.js** rendering engines with seamless switching
- **Modern Glassmorphism UI** — Beautiful frosted-glass interface with Light and Dark mode support
- **Flexible Reading Modes:**
  - 📜 **Continuous Scroll** — Seamless reading with visual chapter breaks (Epub.js only)
  - 📄 **Single Chapter Scroll** — Traditional vertical scrolling within chapters
  - 📖 **Paginated** — Classic book-like page turning with swipe/click navigation
- **Immersive Themes** — Black, White, Sepia (Paper), and Light Blue with custom CSS injection
- **Advanced Customization:**
  - Font size, line height, paragraph spacing, and indent controls
  - Font family selection including **KoPub Batang** for Korean novels
  - Text alignment options (left, center, right, justify)
  - Custom text and background colors
- **Smart Navigation:**
  - Auto-highlighting Table of Contents with current chapter tracking
  - Manual and auto-bookmarking capabilities
  - Location saving and recovery (protected against race conditions)
- **Mobile Responsive** — Touch/swipe controls with adaptive layout for all screen sizes

### 🛠️ Built-in EPUB Editor (Calibre Alternative)
Transform the reader into a full-featured EPUB IDE with lazy loading:

- **CodeMirror Integration** — Syntax highlighting for HTML, CSS, and XML with visual image preview
- **Intelligent Scanner** — Detect typos and OCR errors in English, Korean (Hangul), Japanese (Kana), and Chinese (Hanzi/Kanji)
- **Global Search & Replace** — Support for strings and Regex patterns across the entire book simultaneously
- **TOC & Metadata Management** — Auto-generate Table of Contents from heading tags (`<h1>`, `<h2>`) and edit book metadata (Title/Author)
- **Asset Management** — Import images, stylesheets, or create new chapters directly into the EPUB with automatic `.opf` manifest updates
- **EPUB Debugger** — Scan the book's manifest against actual ZIP contents to detect broken links and missing files
- **EPUB Base64 String Cleaner** — Clean up encoded content for better readability
- **Revert Save** — Instantly restore the book to its original state from when you opened the editor
- **Modular Architecture** — Cleanly separated into workspace, file-manager, xml-tools, search-replace, and diagnostics modules

---

## 💻 Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5 / CSS3 / Vanilla JavaScript** | Core application (no frameworks) |
| **[ePub.js](https://github.com/futurepress/epub.js/)** | Primary EPUB rendering engine |
| **[foliate.js](https://github.com/johnfactotum/foliate-js)** | Alternative rendering engine |
| **[JSZip](https://stuk.github.io/jszip/)** | EPUB archive handling and parsing |
| **[localForage](https://localforage.github.io/localForage/)** | Local storage abstraction (IndexedDB) |
| **[CodeMirror (v5)](https://codemirror.net/5/)** | Code editor integration with syntax highlighting |
| **[Phosphor Icons](https://phosphoricons.com/)** | Modern, lightweight iconography |

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, Safari)
- No server or database setup required!

### Quick Start
1. **Visit the app:** [TK-Epub-Reader on GitHub Pages](https://tk1612.github.io/TK-Epub-Reader/)
2. **Upload your EPUB** — Click the upload button to add books to your local library
3. **Start reading!** — Books are stored locally and persist between sessions

### Local Development
```bash
# Clone the repository
git clone https://github.com/TK1612/TK-Epub-Reader.git
cd TK-Epub-Reader

# Open index.html in your browser
# Or use a local server (e.g., Live Server in VS Code)
```

---

## 📖 Usage Guide

### Reader Controls
- **Delete Books:** Click the red "X" icon in the Library view to toggle Delete Mode
- **Dynamic Taskbar:** Auto-hides when scrolling for maximum screen space (pin it permanently in Settings)
- **Progress Protection:** Location data is safeguarded against race conditions when switching modes or closing the app quickly
- **Engine Switching:** Switch between Epub.js and Foliate.js while preserving your current reading position

### Editor Tips
- **Lazy Loading:** EPUB files are only unzipped into RAM when you explicitly open the Editor—keeping the reader lightning-fast
- **Memory Management:** Close and reopen the Editor to free browser memory for large books
- **File Tree Navigation:** Browse and edit individual files within the EPUB archive
- **Real-time Preview:** See changes instantly with the integrated preview panel

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl + F` | Search in Reader |
| `Ctrl + H` | Search & Replace in Editor |
| `Ctrl + S` | Save changes (Editor) |
| `Esc` | Close modals / Exit Editor |

---

## 📂 Project Structure

```
TK-Epub-Reader/
├── css/
│   ├── base.css              # Base styles and CSS variables
│   ├── components.css        # Reusable UI components
│   ├── editor.css            # Editor-specific styles
│   ├── layout.css            # Layout utilities and grid system
│   ├── library.css           # Library view styles
│   ├── reader.css            # Reader styles
│   ├── style.css             # Main stylesheet
│   └── reader/               # Reader engine overrides
│       ├── epub-overrides.css    # Epub.js CSS injection template
│       ├── foliate-overrides.css # Foliate.js CSS injection template
│       └── reader-layout.css    # Reader layout utilities
├── js/
│   ├── editor.js             # Editor main entry point (loads modules)
│   ├── globals.js            # Global variables and constants
│   ├── library.js            # Library management and upload handling
│   ├── reader.js             # Reader module loader
│   ├── tools.js              # Utility functions
│   ├── ui.js                 # UI controller and modal management
│   ├── editor/               # Editor submodules
│   │   ├── diagnostics.js      # Debugging and spell-check tools
│   │   ├── file-manager.js    # File I/O operations
│   │   ├── modal-helper.js    # Modal open/close operations
│   │   ├── search-replace.js  # Search and replace logic
│   │   ├── workspace.js       # CodeMirror workspace and file tree
│   │   ├── xml-helper.js      # XML parsing and serialization
│   │   └── xml-tools.js       # TOC and metadata management
│   ├── reader/               # Reader submodules
│   │   ├── epub-engine.js      # Epub.js rendering engine
│   │   ├── foliate-engine.js   # Foliate.js rendering engine
│   │   ├── index.js            # Engine dispatcher and switching
│   │   └── settings-helper.js  # Settings load/save utilities
│   └── ui/library/           # UI submodules
│       ├── bookmarks.js        # Bookmark management
│       ├── delete.js           # Book deletion handling
│       ├── editor-list.js      # Editor book list rendering
│       ├── index.js            # Library UI module loader
│       ├── renderer.js         # Library grid/card rendering
│       ├── search.js           # Search and filter logic
│       ├── selection.js        # Book selection handling
│       ├── settings.js         # Library settings modal
│       ├── state.js            # Library state management
│       └── upload.js           # Upload progress and handling
├── assets/                   # Static assets (icons, manifest)
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── apple-touch-icon.png
│   └── site.webmanifest
├── index.html                # Application entry point
└── README.md                 # This file
```

---

## 🌿 Branches

| Branch | Description |
|--------|-------------|
| `main` | Current stable version with refactored modular architecture |
| `previous` | Legacy version before refactoring |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs via [Issues](https://github.com/TK1612/TK-Epub-Reader/issues)
- Suggest features
- Submit pull requests

### Development Guidelines
- Follow the modular architecture pattern
- Maintain backward compatibility
- Test with both Epub.js and Foliate.js engines
- Ensure mobile responsiveness

---

## 📜 License

This project is open-source. (Add your license here if applicable)

---

## 🙏 Acknowledgments

- [ePub.js](https://github.com/futurepress/epub.js/) for the excellent EPUB rendering library
- [Foliate](https://github.com/johnfactotum/foliate) for the alternative reader engine
- [CodeMirror](https://codemirror.net/) for the powerful code editor
- [localForage](https://localforage.github.io/localForage/) for simplifying IndexedDB
- All the open-source libraries that made this project possible

---

## 📊 Stats

- **Zero backend** — Pure client-side application
- **Lightweight** — No heavy frameworks or dependencies
- **Fast** — Lazy loading keeps the reader responsive
- **Compatible** — Works offline after initial load

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/TK1612">TK1612</a>
</p>
