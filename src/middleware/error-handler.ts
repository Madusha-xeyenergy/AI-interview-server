import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError, z } from "zod";

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

// Express 5 forwards errors thrown in async handlers here automatically.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Validation failed",
      details: z.flattenError(err).fieldErrors,
    });
  }

  // File upload problems from multer, e.g. a CV over the size limit.
  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message = err.code === "LIMIT_FILE_SIZE" ? "CV must be 5 MB or smaller" : err.message;
    return res.status(status).json({ error: message });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    ...(env.NODE_ENV === "development" && err instanceof Error && { message: err.message }),
  });
}
