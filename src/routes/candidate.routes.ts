import { Router } from "express";

import {
  applyCandidate,
  getCandidate,
  getCandidateResume,
  getCandidates,
} from "../controllers/candidateController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { uploadCv } from "../middleware/upload.js";

const candidateRouter = Router();

candidateRouter.get("/", requireAuth, requireRole("recruiter"), getCandidates);
candidateRouter.post("/apply", uploadCv.single("resume"), applyCandidate);
candidateRouter.get("/:id", requireAuth, requireRole("recruiter"), getCandidate);
candidateRouter.get("/:id/resume", requireAuth, requireRole("recruiter"), getCandidateResume);

export { candidateRouter };
