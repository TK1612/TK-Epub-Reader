// --- UPLOAD FUNCTIONALITY ---

export async function handleUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadBtn = document.querySelector('.upload-btn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = await file.arrayBuffer();
        const tempBook = ePub(buffer);
        
        await new Promise((resolve) => {
            tempBook.ready.then(async () => {
                let title = file.name.replace(/\.epub$/i, '');
                try {
                    const meta = tempBook.packaging.metadata;
                    if (meta && meta.title) title = meta.title;
                } catch(e) {}
                
                const bookId = "novel_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11); 
                
                let coverBase64 = "";
                try {
                    const coverUrl = await tempBook.coverUrl();
                    if (coverUrl) {
                        const response = await fetch(coverUrl);
                        const blob = await response.blob();
                        coverBase64 = await new Promise((res) => {
                            const reader = new FileReader();
                            reader.onloadend = () => res(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    }
                } catch(e) {
                    console.warn("No cover found or EPUB manifest is malformed. Skipping cover.");
                }

                const bookData = { id: bookId, title: title, buffer: buffer, cover: coverBase64 };
                await localforage.setItem(bookId, bookData);
                
                tempBook.destroy();
                resolve(); 
            }).catch(async (err) => {
                console.warn("EPUB.js failed to parse. Force saving as raw file...", err);
                const bookId = "novel_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
                let fallbackTitle = file.name.replace(/\.epub$/i, '');
                const bookData = { id: bookId, title: fallbackTitle, buffer: buffer, cover: "" };
                
                await localforage.setItem(bookId, bookData);
                tempBook.destroy();
                resolve();
            });
        });
    }

    if (typeof window.loadLibrary === 'function') {
        await window.loadLibrary(1);
    }
    uploadBtn.innerHTML = originalText;
    uploadBtn.disabled = false;
    event.target.value = ''; 
}
