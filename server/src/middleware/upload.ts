import multer from "multer";
import fs from "fs";

// Ensure uploads directory exists at workspace root
fs.mkdirSync("uploads", { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      // Passing an Error with a code lets the route handler detect INVALID_MEDIA
      const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
      err.message = "INVALID_MEDIA";
      cb(err);
    }
  },
});
