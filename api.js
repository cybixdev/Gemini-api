// BetterBox: Permanent File/Image Hosting API
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PORT = process.env.PORT || 3000;

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage });

const app = express();
app.use(cors());

// Health check
app.get('/', (req, res) => {
  res.json({
    status: "OK",
    message: "Welcome to BetterBox API. Upload your files/images via POST /upload"
  });
});

// Upload endpoint: POST /upload (form-data key: file)
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.file.filename}`;
  res.json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// Serve uploaded files
app.get('/files/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
  res.sendFile(filePath);
});

// List all uploaded files (GET /files)
app.get('/files', (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).map(fname => ({
    filename: fname,
    url: `${req.protocol}://${req.get('host')}/files/${fname}`
  }));
  res.json({ files });
});

// Delete a file (DELETE /files/:filename)
app.delete('/files/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
  fs.unlinkSync(filePath);
  res.json({ success: true, deleted: req.params.filename });
});

// Start server
app.listen(PORT, () => {
  console.log(`BetterBox API running on port ${PORT}`);
});