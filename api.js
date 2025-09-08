// BetterBox: Permanent Image Hosting API
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const UPLOAD_DIR = path.join(__dirname, 'images');
const PORT = process.env.PORT || 3000;

// Allowed image mime types
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  'image/tiff',
  'image/avif'
];

// Ensure 'images' directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// Configure Multer for image uploads only
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const app = express();
app.use(cors());

// Health check
app.get('/', (req, res) => {
  res.json({
    status: "OK",
    message: "BetterBox Image API. Upload images via POST /upload"
  });
});

// Upload endpoint: POST /upload (form-data key: image)
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded.' });
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/i/${req.file.filename}`;
  res.json({
    success: true,
    url: imageUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// Serve uploaded images
app.get('/i/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Image not found.');
  }
  res.sendFile(filePath);
});

// Optional: Preview page for the image
app.get('/preview/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Image not found.');
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/i/${req.params.filename}`;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BetterBox Image Preview</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { background: #f7f7fa; color: #222; font-family: Arial,sans-serif; text-align: center; padding: 38px;}
        img { max-width: 95vw; max-height: 75vh; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 1px 8px #0002;}
        .url-box { margin-top:22px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 12px 8px; display: inline-block; }
        .copy-btn { margin-left:10px;background:#2b60e5;color:#fff;border:none;padding:4px 13px;border-radius:3px;font-size:1rem;cursor:pointer;}
      </style>
    </head>
    <body>
      <h2>BetterBox Image Preview</h2>
      <img src="${imageUrl}" alt="Image" />
      <div class="url-box">
        <input type="text" value="${imageUrl}" id="imgurl" readonly style="width:70%;font-size:1rem;border:none;background:transparent;"/>
        <button class="copy-btn" onclick="navigator.clipboard.writeText('${imageUrl}');this.textContent='Copied!'">Copy</button>
      </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`BetterBox Image API running on port ${PORT}`);
});