class PDFEditorApp {
    constructor() {
        this.currentPDF = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.scale = 1.5;
        this.selectedTextElement = null;
        this.edits = [];

        this.elements = {
            uploadSection: document.getElementById('uploadSection'),
            editorSection: document.getElementById('editorSection'),
            fileInput: document.getElementById('fileInput'),
            uploadArea: document.getElementById('uploadArea'),
            fileName: document.getElementById('fileName'),
            pageInfo: document.getElementById('pageInfo'),
            pdfCanvas: document.getElementById('pdfCanvas'),
            textLayer: document.getElementById('textLayer'),
            fontSizeSlider: document.getElementById('fontSize'),
            fontSizeValue: document.getElementById('fontSizeValue'),
            fontBoldBtn: document.getElementById('fontBoldBtn'),
            fontItalicBtn: document.getElementById('fontItalicBtn'),
            textColorPicker: document.getElementById('textColor'),
            textBgColorPicker: document.getElementById('textBgColor'),
            fontFamilySelect: document.getElementById('fontFamily'),
            selectedTextInput: document.getElementById('selectedTextInput'),
            applyChangesBtn: document.getElementById('applyChangesBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
        };

        this.initializeEventListeners();
    }

    // ✅ THIS IS THE FINAL FIX
    // All event listeners now use arrow functions `() =>` to ensure `this` always
    // refers to the PDFEditorApp class, fixing the "is not a function" error.
    initializeEventListeners() {
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
        this.elements.uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); e.target.classList.add('dragover'); });
        this.elements.uploadArea.addEventListener('dragleave', (e) => e.target.classList.remove('dragover'));
        
        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));
        
        this.elements.applyChangesBtn.addEventListener('click', () => this.applyTextChanges());
        this.elements.downloadBtn.addEventListener('click', () => this.downloadPDF());

        // Visual styling listeners
        this.elements.fontSizeSlider.addEventListener('input', (e) => this.updateVisualStyles(e));
        this.elements.fontBoldBtn.addEventListener('click', (e) => this.updateVisualStyles(e));
        this.elements.fontItalicBtn.addEventListener('click', (e) => this.updateVisualStyles(e));
        this.elements.textColorPicker.addEventListener('input', (e) => this.updateVisualStyles(e));
        this.elements.textBgColorPicker.addEventListener('input', (e) => this.updateVisualStyles(e));
        this.elements.fontFamilySelect.addEventListener('change', (e) => this.updateVisualStyles(e));
        this.elements.selectedTextInput.addEventListener('input', (e) => this.updateVisualStyles(e));
    }

    async downloadPDF() {
        if (!this.currentPDF || !this.currentPDF.filename) {
            alert('Please upload a file first.');
            return;
        }
        if (this.edits.length === 0) {
            alert('No changes have been applied. Please click "Apply Changes" to record your edits before downloading.');
            return;
        }

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: this.currentPDF.filename, edits: this.edits }),
            });
            const result = await response.json();
            if (result.success) {
                window.open(result.url, '_blank');
            } else {
                throw new Error(result.error || 'Server failed to create edited PDF.');
            }
        } catch (error) {
            console.error('Download failed:', error);
            alert(`Download failed: ${error.message}`);
        }
    }

    applyTextChanges() {
        if (!this.selectedTextElement) {
            alert('Please select a text element first.');
            return;
        }
        
        const editData = {
            page: this.currentPage - 1,
            text: this.elements.selectedTextInput.value,
            x: parseFloat(this.selectedTextElement.dataset.x),
            y: parseFloat(this.selectedTextElement.dataset.y),
            originalWidth: parseFloat(this.selectedTextElement.dataset.width),
            originalHeight: parseFloat(this.selectedTextElement.dataset.height),
            size: parseInt(this.elements.fontSizeSlider.value),
            color: this.hexToRgb(this.elements.textColorPicker.value),
            backgroundColor: this.hexToRgb(this.elements.textBgColorPicker.value),
            fontFamily: this.elements.fontFamilySelect.value,
            isBold: this.elements.fontBoldBtn.classList.contains('active'),
            isItalic: this.elements.fontItalicBtn.classList.contains('active'),
        };

        this.edits.push(editData);
        console.log("Edit recorded:", editData);
        alert('Changes applied and recorded! You can apply more changes or click Download.');
    }

    selectTextElement(element) {
        if (this.selectedTextElement) {
            this.selectedTextElement.classList.remove('selected');
        }
        this.selectedTextElement = element;
        element.classList.add('selected');

        this.elements.selectedTextInput.value = element.textContent;
        const style = window.getComputedStyle(element);
        const fontSize = parseInt(style.fontSize, 10);
        this.elements.fontSizeSlider.value = fontSize;
        this.elements.fontSizeValue.textContent = `${fontSize}px`;
        this.elements.fontBoldBtn.classList.toggle('active', style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700);
        this.elements.fontItalicBtn.classList.toggle('active', style.fontStyle === 'italic');
        this.elements.textColorPicker.value = this.rgbToHex(style.color);
        this.elements.textBgColorPicker.value = this.rgbToHex(style.backgroundColor);
        this.elements.fontFamilySelect.value = style.fontFamily.split(',')[0].replace(/"/g, '').trim();
    }
    
    updateVisualStyles(event) {
        if (!this.selectedTextElement) return;
        if (event && event.currentTarget && event.currentTarget.classList.contains('btn-format')) { 
            event.currentTarget.classList.toggle('active');
        }
        this.elements.fontSizeValue.textContent = `${this.elements.fontSizeSlider.value}px`;
        this.selectedTextElement.textContent = this.elements.selectedTextInput.value;
        this.selectedTextElement.style.fontSize = `${this.elements.fontSizeSlider.value}px`;
        this.selectedTextElement.style.fontWeight = this.elements.fontBoldBtn.classList.contains('active') ? 'bold' : 'normal';
        this.selectedTextElement.style.fontStyle = this.elements.fontItalicBtn.classList.contains('active') ? 'italic' : 'normal';
        this.selectedTextElement.style.color = this.elements.textColorPicker.value;
        this.selectedTextElement.style.fontFamily = this.elements.fontFamilySelect.value;
        this.selectedTextElement.style.backgroundColor = this.elements.textBgColorPicker.value;
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) await this.processPDFFile(file);
    }

    async handleFileDrop(event) {
        event.preventDefault();
        this.elements.uploadArea.classList.remove('dragover');
        const file = event.dataTransfer.files[0];
        if (file) await this.processPDFFile(file);
    }
    
    async processPDFFile(file) {
        const formData = new FormData();
        formData.append('pdf', file);
        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            this.currentPDF = result.file;
            this.elements.fileName.textContent = this.currentPDF.originalname;
            this.elements.uploadSection.style.display = 'none';
            this.elements.editorSection.style.display = 'block';
            await this.loadPDF(this.currentPDF.url);
        } catch(error) {
            alert(`File upload failed: ${error.message}`);
        }
    }

    async loadPDF(pdfUrl) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        this.totalPages = pdf.numPages;
        this.currentPage = 1;
        this.currentPDF.pdfDoc = pdf;
        await this.renderPage(this.currentPage);
    }
    
    async renderPage(pageNum) {
        const page = await this.currentPDF.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale });
        this.elements.pdfCanvas.height = viewport.height;
        this.elements.pdfCanvas.width = viewport.width;
        this.elements.textLayer.innerHTML = '';
        const context = this.elements.pdfCanvas.getContext('2d');
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        await this.setupTextLayer(page, viewport);
        this.updatePageControls();
    }

    async setupTextLayer(page, viewport) {
        const textContent = await page.getTextContent();
        textContent.items.forEach(item => {
            if (item.str.trim().length === 0) return;
            const el = document.createElement('div');
            el.className = 'text-element';
            const [x, y, width, height] = [item.transform[4], item.transform[5], item.width, item.height];
            const top = viewport.height - y - height;
            Object.assign(el.style, {
                left: `${x}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`,
                fontSize: `${height}px`, fontFamily: item.fontName
            });
            el.dataset.x = x;
            el.dataset.y = y;
            el.dataset.width = width;
            el.dataset.height = height;
            el.textContent = item.str;
            el.onclick = () => this.selectTextElement(el);
            this.elements.textLayer.appendChild(el);
        });
    }
    
    changePage(offset) {
        const newPage = this.currentPage + offset;
        if (newPage > 0 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.renderPage(this.currentPage);
        }
    }

    updatePageControls() {
        this.elements.pageInfo.textContent = `Page ${this.currentPage} / ${this.totalPages}`;
    }

    hexToRgb(hex) {
        if (!hex) return { r: 255, g: 255, b: 255 };
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
    }

    rgbToHex(rgb) {
        if (!rgb || !rgb.includes('rgb')) return '#000000';
        let sep = rgb.includes(",") ? "," : " ";
        rgb = rgb.substr(4).split(")")[0].split(sep);
        let r = (+rgb[0]).toString(16), g = (+rgb[1]).toString(16), b = (+rgb[2]).toString(16);
        if (r.length == 1) r = "0" + r;
        if (g.length == 1) g = "0" + g;
        if (b.length == 1) b = "0" + b;
        return "#" + r + g + b;
    }
}

document.addEventListener('DOMContentLoaded', () => { new PDFEditorApp(); });