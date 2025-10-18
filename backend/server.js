const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const app = express();
const PORT = 5000;

// --- Setup ---
const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync(path.join(__dirname, 'downloads'))){
    fs.mkdirSync(path.join(__dirname, 'downloads'));
}

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// --- API Routes ---

app.post('/api/upload', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
    res.json({
        success: true,
        file: { filename: req.file.filename, originalname: req.file.originalname, url: `/uploads/${req.file.filename}` }
    });
});

app.post('/api/download', async (req, res) => {
    const { filename, edits } = req.body;
    if (!filename || !edits) {
        return res.status(400).json({ success: false, error: 'Missing filename or edits.' });
    }

    try {
        const originalPdfPath = path.join(__dirname, 'uploads', filename);
        const pdfBytes = fs.readFileSync(originalPdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Embed all the fonts we might need
        const fonts = {
            Arial: {
                normal: await pdfDoc.embedFont(StandardFonts.Helvetica),
                bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
                italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
            },
            Helvetica: {
                normal: await pdfDoc.embedFont(StandardFonts.Helvetica),
                bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
                italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
            },
            'Times New Roman': {
                normal: await pdfDoc.embedFont(StandardFonts.TimesRoman),
                bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
                italic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
            },
            'Courier New': {
                normal: await pdfDoc.embedFont(StandardFonts.Courier),
                bold: await pdfDoc.embedFont(StandardFonts.CourierBold),
                italic: await pdfDoc.embedFont(StandardFonts.CourierOblique),
            },
            'Verdana': { // Fallback for Verdana
                normal: await pdfDoc.embedFont(StandardFonts.Helvetica),
                bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
                italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
            }
        };
        
        for (const edit of edits) {
            const page = pdfDoc.getPages()[edit.page];
            
            // 1. Erase old text and draw new background in one step
            page.drawRectangle({
                x: edit.x,
                y: edit.y - 2,
                width: edit.originalWidth,
                height: edit.originalHeight + 2,
                color: rgb(edit.backgroundColor.r / 255, edit.backgroundColor.g / 255, edit.backgroundColor.b / 255),
            });

            // 2. Select the correct font
            let fontToUse = fonts[edit.fontFamily]?.normal || fonts.Helvetica.normal;
            if (edit.isBold) fontToUse = fonts[edit.fontFamily]?.bold || fonts.Helvetica.bold;
            if (edit.isItalic) fontToUse = fonts[edit.fontFamily]?.italic || fonts.Helvetica.italic;
            
            // 3. Draw the new text
            page.drawText(edit.text, {
                x: edit.x,
                y: edit.y,
                font: fontToUse,
                size: edit.size,
                color: rgb(edit.color.r / 255, edit.color.g / 255, edit.color.b / 255),
            });
        }

        const modifiedPdfBytes = await pdfDoc.save();
        const newFilename = `edited-${Date.now()}.pdf`;
        const downloadPath = path.join(__dirname, 'downloads', newFilename);
        fs.writeFileSync(downloadPath, modifiedPdfBytes);

        res.json({ success: true, url: `/downloads/${newFilename}` });

    } catch (error) {
        console.error('ERROR processing PDF:', error);
        res.status(500).json({ success: false, error: 'Failed to modify PDF on the server.' });
    }
});

// --- Main Route ---
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server is running. Open your browser and go to http://localhost:${PORT}`);
});