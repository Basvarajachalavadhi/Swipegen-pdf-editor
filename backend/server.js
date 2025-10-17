const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const app = express();
const PORT = 5000;

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS configuration to allow your frontend's IP address
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.229.118.253:3000' // Your computer's IP
];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- API ROUTES ---

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.post('/api/upload', upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    res.json({ success: true, file: { ...req.file, url: `/uploads/${req.file.filename}` } });
});

// **FINAL FIX**: Correctly positions text by using the y-coordinate directly
app.post('/api/download', async (req, res) => {
    const { filename, edits } = req.body;
    if (!filename || !edits) return res.status(400).json({ error: 'Filename and edits are required.' });

    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Original file not found.' });

    try {
        const pdfBytes = await fs.promises.readFile(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();

        for (const edit of edits) {
            const page = pages[edit.page];
            if (page) {
                // **STEP 1: ERASE OLD TEXT**
                // Draw a white rectangle over the old text's location.
                // We use 'edit.y' directly, adjusting slightly for text baseline.
                page.drawRectangle({
                    x: edit.x - 2,
                    y: edit.y - (edit.originalHeight * 0.2), // Adjust down from the baseline
                    width: edit.originalWidth + 4,
                    height: edit.originalHeight + 4,
                    color: rgb(1, 1, 1), // White color
                });

                // **STEP 2: DRAW NEW TEXT**
                // Use the 'edit.y' coordinate directly, as both libraries measure from the bottom.
                page.drawText(edit.text, {
                    x: edit.x,
                    y: edit.y, // Use the Y coordinate directly without flipping
                    font: font,
                    size: edit.size,
                    color: edit.color ? rgb(edit.color.r / 255, edit.color.g / 255, edit.color.b / 255) : rgb(0, 0, 0),
                });
            }
        }

        const newPdfBytes = await pdfDoc.save();
        const newFilename = `edited-${filename}`;
        const outputPath = path.join(uploadsDir, newFilename);
        await fs.promises.writeFile(outputPath, newPdfBytes);

        res.json({ success: true, url: `http://localhost:${PORT}/uploads/${newFilename}` });

    } catch (error) {
        console.error('Error creating edited PDF:', error);
        res.status(500).json({ error: 'Failed to edit PDF.' });
    }
});

app.listen(PORT, () => console.log(`🚀 Backend server running on http://localhost:${PORT}`));