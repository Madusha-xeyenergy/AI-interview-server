import type { Request, Response } from "express";

import {
  applyCandidateService,
  getCandidateByIdService,
  getCandidatesService,
} from "../services/candidateService.js";
import { openResumeStream } from "../utils/gridfs.js";
import { HttpError } from "../utils/http-error.js";
import { applyCandidateSchema, candidateIdParamSchema } from "../validators/candidate.validator.js";

// GET /api/candidates (recruiters only)
const getCandidates = async (_req: Request, res: Response) => {
  const candidates = await getCandidatesService();
  res.status(200).json({ message: "Candidates fetched successfully", candidates });
};

// GET /api/candidates/:id (recruiters only)
const getCandidate = async (req: Request, res: Response) => {
  const { id } = candidateIdParamSchema.parse(req.params);
  const candidate = await getCandidateByIdService(id);
  res.status(200).json({ candidate });
};

// GET /api/candidates/:id/resume (recruiters only): streams the CV PDF from GridFS.
const getCandidateResume = async (req: Request, res: Response) => {
  const { id } = candidateIdParamSchema.parse(req.params);
  const { resume } = await getCandidateByIdService(id);
  if (!resume) {
    throw new HttpError(404, "This candidate has no CV on file");
  }

  res.setHeader("Content-Type", resume.contentType);
  // "inline" → the browser opens the PDF in a tab instead of downloading it.
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(resume.filename)}"`);

  // Send the file chunk by chunk instead of loading it all into memory.
  openResumeStream(resume.fileId)
    .on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "CV file not found" });
      else res.end();
    })
    .pipe(res);
};

// POST /api/candidates/apply: public, multipart form with a "resume" PDF field.
// The uploadCv middleware runs first and puts the file in req.file.
const applyCandidate = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new HttpError(400, "CV file is required", { resume: ["Upload your CV as a PDF"] });
  }

  const input = applyCandidateSchema.parse(req.body); // invalid body → ZodError → 422 via error-handler
  const candidate = await applyCandidateService(input, req.file);

  res.status(201).json({ message: "Application submitted successfully", candidate });
};

export { getCandidates, getCandidate, getCandidateResume, applyCandidate };
