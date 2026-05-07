# TK EPUB Reader & Editor 📖✨

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-success?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/Version-2.0-blue?style=flat-square" alt="Version">
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

## 📸 Preview

![TK EPUB Reader Screenshot](https://github.com/user-attachments/assets/6f7abce4-5bd4-434f-8828-5a20f86740b7)

---

## ✨ Key Features

### 📚 Reader Features
- **Offline Local Library** — Upload and store EPUB files directly in your browser using IndexedDB (`localforage`)
- **Dual Engine Support** — Choose between **Epub.js** and **Foliate.js** rendering engines
- **Modern Glassmorphism UI** — Beautiful frosted-glass interface with Light and Dark mode support
- **Flexible Reading Modes:**
  - 📜 **Continuous Scroll** — Seamless reading with visual chapter breaks
  - 📄 **Single Chapter** — Traditional vertical scrolling
  - 📖 **Paginated** — Classic book-like page turning
- **Immersive Themes** — Black, White, Sepia (Paper), and Light Blue with custom CSS injection
- **Deep Customization** — Font size, line height, font family (including **KoPub Batang** for Korean), text alignment, and colors
- **Smart Navigation** — Auto-highlighting Table of Contents and bookmark support
- **Mobile Responsive** — Touch/swipe controls with adaptive layout

### 🛠️ Built-in EPUB Editor
Transform the reader into a full-featured EPUB IDE:

- **CodeMirror Integration** — Syntax highlighting for HTML, CSS, and XML with image preview
- **Intelligent Scanner** — Detect typos and OCR errors in English, Korean, Japanese, and Chinese
- **Global Search & Replace** — Support for strings and Regex patterns across the entire book
- **TOC & Metadata Management** — Auto-generate Table of Contents and edit book metadata
- **Asset Management** — Import images, stylesheets, or create new chapters with automatic `.opf` manifest updates
- **EPUB Debugger** — Detect broken links and missing files by scanning manifest against ZIP contents
- **Base64 String Cleaner** — Clean up encoded content
- **Revert Save** — Instantly restore the book to its original state

---

## 💻 Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5 / CSS3 / Vanilla JavaScript** | Core application |
| **[ePub.js](https://github.com/futurepress/epub.js/)** | Primary EPUB rendering engine |
| **[foliate.js](https://github.com/johnfactotum/foliate-js)** | Alternative rendering engine |
| **[JSZip](https://stuk.github.io/jszip/)** | EPUB archive handling |
| **[localForage](https://localforage.github.io/localForage/)** | Local storage (IndexedDB) |
| **[CodeMirror (v5)](https://codemirror.net/5/)** | Code editor integration |
| **[Phosphor Icons](https://phosphoricons.com/)** | UI iconography |

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
- **Dynamic Taskbar:** Auto-hides when scrolling for maximum screen space (pin it in Settings)
- **Progress Protection:** Location data is safeguarded against race conditions when switching modes

### Editor Tips
- **Lazy Loading:** EPUB files are only unzipped into RAM when you open the Editor—keeping the reader lightning-fast
- **Memory Management:** Close and reopen the Editor to free browser memory for large books

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl + F` | Search in Reader |
| `Ctrl + S` | Save changes (Editor) |
| `Esc` | Close modals / Exit Editor |

---

## 📂 Project Structure

```
TK-Epub-Reader/
├── css/
│   ├── base.css              # Base styles
│   ├── components.css        # Reusable components
│   ├── editor.css            # Editor-specific styles
│   ├── layout.css            # Layout utilities
│   ├── library.css           # Library view styles
│   ├── reader.css            # Reader styles
│   ├── style.css             # Main stylesheet
│   └── reader/               # Reader engine overrides
│       ├── epub-overrides.css
│       ├── foliate-overrides.css
│       └── reader-layout.css
├── js/
│   ├── editor.js             # Editor main module
│   ├── globals.js            # Global variables
│   ├── library.js            # Library management
│   ├── reader.js             # Reader main module
│   ├── tools.js              # Utility functions
│   ├── ui.js                 # UI controller
│   ├── editor/               # Editor submodules
│   │   ├── diagnostics.js
│   │   ├── file-manager.js
│   │   ├── modal-helper.js
│   │   ├── search-replace.js
│   │   ├── workspace.js
│   │   ├── xml-helper.js
│   │   └── xml-tools.js
│   ├── reader/               # Reader submodules
│   │   ├── epub-engine.js
│   │   ├── foliate-engine.js
│   │   ├── index.js
│   │   └── settings-helper.js
│   └── ui/library/           # UI submodules
│       ├── bookmarks.js
│       ├── delete.js
│       ├── editor-list.js
│       ├── index.js
│       ├── renderer.js
│       ├── search.js
│       ├── selection.js
│       ├── settings.js
│       ├── state.js
│       └── upload.js
├── assets/                   # Static assets (icons, manifest)
├── index.html                # Entry point
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

---

## 📜 License

This project is open-source. (Add your license here if applicable)

---

## 🙏 Acknowledgments

- [ePub.js](https://github.com/futurepress/epub.js/) for the excellent EPUB rendering library
- [Foliate](https://github.com/johnfactotum/foliate) for the alternative reader engine
- All the open-source libraries that made this project possible

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/TK1612">TK1612</a>
</p>
