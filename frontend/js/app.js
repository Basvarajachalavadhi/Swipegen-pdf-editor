class PDFEditorApp {
    constructor() {
        this.currentPDF = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.scale = 1.5;
        this.edits = [];
        this.selectedTextElement = null;
        this.backendURL = 'http://localhost:5000';
        
        this.initializeEventListeners();
        this.checkBackend();
    }

    initializeEventListeners() {
        // --- All your existing event listeners are correct and go here ---
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                this.processPDFFile(files[0]);
            }
        });
        document.getElementById('saveBtn').addEventListener('click', () => this.savePDF());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadPDF());
        document.getElementById('newBtn').addEventListener('click', () => this.newFile());
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('prevPage').addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());
        document.getElementById('applyText').addEventListener('click', () => this.applyTextChanges());
        document.getElementById('fontSize').addEventListener('input', (e) => this.updateFontSize(e));
        document.getElementById('textColor').addEventListener('input', (e) => this.updateTextColor(e));
        document.getElementById('fontFamily').addEventListener('change', (e) => this.updateFontFamily(e));
        document.getElementById('textInput').addEventListener('input', () => this.previewTextChanges());
    }

    async checkBackend() {
        try {
            await fetch(`${this.backendURL}/api/health`);
            this.showStatus('Backend connected!', 'success');
        } catch (error) {
            this.showStatus('Backend not found. Download will not work.', 'warning');
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') this.processPDFFile(file);
    }

    async processPDFFile(file) {
        this.showLoading(true, "Uploading and preparing PDF...");
        const formData = new FormData();
        formData.append('pdf', file);
        try {
            const response = await fetch(`${this.backendURL}/api/upload`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('File upload to backend failed');
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Backend upload error');
            this.currentPDF = { ...result.file, url: `${this.backendURL}${result.file.url}` };
            await this.loadPDF();
            this.showEditor();
        } catch (error) {
            console.error('Upload error, falling back to client-side:', error);
            this.currentPDF = { filename: file.name, originalname: file.name, url: URL.createObjectURL(file) };
            this.showStatus('Using local mode. Edited download will not work.', 'info');
            await this.loadPDF();
            this.showEditor();
        } finally {
            this.showLoading(false);
        }
    }

    async loadPDF() {
        try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            const pdf = await pdfjsLib.getDocument(this.currentPDF.url).promise;
            this.totalPages = pdf.numPages;
            this.currentPage = 1;
            this.showStatus(`PDF loaded with ${this.totalPages} pages. Ready to edit.`, 'success');
            await this.renderPage(this.currentPage);
            this.updatePageControls();
        } catch (error) {
            console.error('PDF Load Error:', error);
            this.showStatus('Failed to load PDF.', 'error');
        }
    }

    async renderPage(pageNum) {
        try {
            const pdf = await pdfjsLib.getDocument(this.currentPDF.url).promise;
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });
            
            const canvas = document.getElementById('pdfCanvas');
            const textLayer = document.getElementById('textLayer');
            const ctx = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            textLayer.innerHTML = '';
            textLayer.style.width = `${viewport.width}px`;
            textLayer.style.height = `${viewport.height}px`;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            await this.setupTextLayer(page, viewport);
        } catch (error) {
            console.error('Render Page Error:', error);
        }
    }

    async setupTextLayer(page, viewport) {
        const textContent = await page.getTextContent();
        const textLayer = document.getElementById('textLayer');
        
        textContent.items.forEach(item => {
            if (item.str.trim().length === 0) return;

            const textElement = document.createElement('div');
            textElement.className = 'text-element';
            
            const [x, y, width, height] = [item.transform[4], item.transform[5], item.width, item.height];

            // **THE FIX**: Correctly calculate the top position for CSS
            // The original 'y' is from the bottom of the page.
            // We convert it to a 'top' value by subtracting it from the page height.
            const topPosition = viewport.height - y - height;

            // Store all original data needed for erasing on the backend
            Object.assign(textElement.dataset, {
                originalText: item.str,
                page: this.currentPage - 1,
                x: x,
                y: y, // Store the original bottom-up y-coordinate for the backend
                width: width,
                height: height,
            });

            // Apply styles for the visual overlay on the screen
            Object.assign(textElement.style, {
                left: `${x}px`,
                top: `${topPosition}px`, // Use the corrected 'top' value
                height: `${height}px`,
                width: `${width}px`,
            });
            
            textElement.onclick = (e) => { e.stopPropagation(); this.selectTextElement(textElement); };
            textLayer.appendChild(textElement);
        });
        
        this.showAllTextAreas();
    }
    
    showAllTextAreas() {
        const textElements = document.querySelectorAll('.text-element');
        textElements.forEach(el => el.style.display = 'block');
        this.showStatus(`Found ${textElements.length} text areas. Click any red box to edit.`, 'info');
    }

    selectTextElement(element) {
        if (this.selectedTextElement) {
            this.selectedTextElement.classList.remove('selected');
        }
        this.selectedTextElement = element;
        element.classList.add('selected');

        document.getElementById('textInput').value = element.dataset.originalText;
        document.getElementById('applyText').disabled = false;
        document.getElementById('fontSize').value = parseFloat(element.dataset.height);
        this.showStatus('Text selected. You can now edit in the panel.', 'success');
    }

    applyTextChanges() {
        if (!this.selectedTextElement) return;

        const newText = document.getElementById('textInput').value;
        const fontSize = document.getElementById('fontSize').value;
        const color = document.getElementById('textColor').value;

        this.selectedTextElement.textContent = newText;
        this.selectedTextElement.style.fontSize = `${fontSize}px`;
        this.selectedTextElement.style.color = color;
        
        this.recordEdit({
            page: parseInt(this.selectedTextElement.dataset.page),
            text: newText,
            x: parseFloat(this.selectedTextElement.dataset.x),
            y: parseFloat(this.selectedTextElement.dataset.y), // Send original y for backend calculation
            originalWidth: parseFloat(this.selectedTextElement.dataset.width),
            originalHeight: parseFloat(this.selectedTextElement.dataset.height),
            size: parseFloat(fontSize),
            color: this.hexToRgb(color),
        });
        
        this.showStatus('Changes applied!', 'success');
    }

    async downloadPDF() {
        if (!this.currentPDF || !this.currentPDF.filename) {
            return this.showStatus('Please upload a file first.', 'error');
        }
        if (this.edits.length === 0) {
            this.showStatus('No edits made. Downloading original file.', 'info');
            return window.open(`${this.backendURL}/uploads/${this.currentPDF.filename}`);
        }

        this.showLoading(true, 'Generating your edited PDF...');
        try {
            const response = await fetch(`${this.backendURL}/api/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: this.currentPDF.filename, edits: this.edits })
            });
            if (!response.ok) throw new Error('Server responded with an error.');
            const result = await response.json();
            if (result.success && result.url) {
                window.open(result.url, '_blank');
                this.showStatus('Your edited PDF is ready!', 'success');
            } else {
                throw new Error(result.error || 'Server did not return a valid URL.');
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showStatus(`Download failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // --- Other Helper Methods ---
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : {r:0, g:0, b:0};
    }
    recordEdit(edit) { this.edits.push(edit); console.log('Current edits:', this.edits); this.updateEditHistory(); }
    updateEditHistory() { /* Your existing history logic */ }
    savePDF() { this.showStatus('Changes are ready for download.', 'info'); }
    newFile() { window.location.reload(); }
    zoomIn() { this.scale += 0.25; this.renderPage(this.currentPage); }
    zoomOut() { this.scale = Math.max(0.5, this.scale - 0.25); this.renderPage(this.currentPage); }
    previousPage() { if (this.currentPage > 1) { this.currentPage--; this.renderPage(this.currentPage); } }
    nextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.renderPage(this.currentPage); } }
    updatePageControls() { document.getElementById('pageInfo').textContent = `Page ${this.currentPage} / ${this.totalPages}`; }
    showEditor() { document.getElementById('uploadSection').style.display = 'none'; document.getElementById('editorSection').style.display = 'block'; }
    showLoading(show, message = 'Processing...') { document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none'; }
    showStatus(message, type) { const toast = document.getElementById('statusToast'); toast.textContent = message; toast.className = `status-toast ${type} show`; setTimeout(() => toast.classList.remove('show'), 4000); }
    updateFontSize(e) { if (this.selectedTextElement) this.selectedTextElement.style.fontSize = `${e.target.value}px`; }
    updateTextColor(e) { if (this.selectedTextElement) this.selectedTextElement.style.color = e.target.value; }
    updateFontFamily(e) { if (this.selectedTextElement) this.selectedTextElement.style.fontFamily = e.target.value; }
}

document.addEventListener('DOMContentLoaded', () => { window.pdfEditor = new PDFEditorApp(); });