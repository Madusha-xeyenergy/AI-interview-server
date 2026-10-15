import { Router } from "express";

import {
  createInterview,
  getInterview,
  getInterviews,
  previewQuestions,
  runEvaluation,
} from "../controllers/interviewController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

// Recruiter-only router. Candidate (public) routes live in invite.routes.ts.
const interviewRouter = Router();

interviewRouter.use(requireAuth, requireRole("recruiter")); // applies to every route below

interviewRouter.post("/questions", previewQuestions);
interviewRouter.post("/", createInterview);
interviewRouter.get("/", getInterviews);
interviewRouter.get("/:id", getInterview);
interviewRouter.post("/:id/evaluate", runEvaluation);

export { interviewRouter };
