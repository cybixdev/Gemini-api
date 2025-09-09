// BetterBox: Permanent Image Hosting API (Render Persistent Disk)
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const PORT = process.env.PORT || 3000;

// Persistent disk path
const PERSISTENT_PATH = '/data';
const UPLOAD_DIR = path.join(PERSISTENT_PATH, 'images');

// Ensure persistent disk exists
if (!fs.existsSync(PERSISTENT_PATH)) {
  console.error('❌ Persistent disk not found at /data. Attach a disk in render.yaml!');
  process.exit(1);
}

// Ensure images folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed image types
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

// Multer config
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
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed!'));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const app = express();
app.use(cors());

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'BetterBox Permanent Image API. Upload images via POST /upload'
  });
});

// Upload endpoint
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded.' });
  
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
  if (!fs.existsSync(filePath)) return res.status(404).send('Image not found.');
  res.sendFile(filePath);
});

// Preview page
app.get('/preview/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Image not found.');
  
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
        <input type="text" value="${imageUrl}" readonly style="width:70%;font-size:1rem;border:none;background:transparent;"/>
        <button class="copy-btn" onclick="navigator.clipboard.writeText('${imageUrl}');this.textContent='Copied!'">Copy</button>
      </div>
    </body>
    </html>
  `);
});

// List all uploaded images
app.get('/list', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const images = files.map(filename => ({
      filename,
      url: `${req.protocol}://${req.get('host')}/i/${filename}`
    }));
    // Sort newest first
    images.sort((a, b) => fs.statSync(path.join(UPLOAD_DIR, b.filename)).mtimeMs - fs.statSync(path.join(UPLOAD_DIR, a.filename)).mtimeMs);
    
    res.json({ success: true, count: images.length, images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ BetterBox API running on port ${PORT}`);
});