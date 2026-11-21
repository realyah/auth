const multer = require('multer');

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

// Detect the real image type from the file's first bytes. The client-supplied
// mimetype and file name are not trusted.
const detectImageType = (buffer) => {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
};

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
}).single('avatar');

// Wraps multer so its errors become clean 400 JSON responses
const uploadAvatar = (req, res, next) => {
  avatarUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 2 MB or smaller'
        : `Upload error: ${err.message}`;
      return res.status(400).json({ error: message });
    }
    if (err) return next(err);

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded. Send it as multipart field "avatar"' });
    }
    const ext = detectImageType(req.file.buffer);
    if (!ext) {
      return res.status(400).json({ error: 'Only JPEG, PNG or WebP images are allowed' });
    }
    req.file.detectedExt = ext;
    next();
  });
};

module.exports = { uploadAvatar, detectImageType, MAX_AVATAR_BYTES };
