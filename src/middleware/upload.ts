import multer from "multer";

import { HttpError } from "../utils/http-error.js";

const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 MB

// Keeps the file in memory (req.file.buffer): it is read for text, then saved to GridFS.
const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      return callback(new HttpError(415, "CV must be a PDF file"));
    }
    callback(null, true);
  },
});

export { uploadCv };
