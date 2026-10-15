import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { createJob , getJobs } from "../controllers/jobController.js";

const jobRouter = Router();

jobRouter.post("/create", requireAuth, requireRole("recruiter"), createJob);
jobRouter.get("/", requireAuth, requireRole("recruiter"), getJobs);


export { jobRouter };