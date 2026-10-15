import type { Request, Response } from "express";

import { createJobService, getJobsService } from "../services/jobService.js";
import { HttpError } from "../utils/http-error.js";
import { createJobSchema } from "../validators/job.validators.js";

// POST /api/jobs: creates a job owned by the logged-in user. `req.user` is set by requireAuth.
const createJob = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated");
  }

  const jobInput = createJobSchema.parse(req.body); // invalid body → ZodError → 422 via error-handler
  const job = await createJobService(jobInput, req.user.id);

  res.status(201).json({ message: "Job created successfully", job });
};

const getJobs = async (_req: Request, res: Response) => {
  const jobs = await getJobsService();
  res.status(200).json({ message: "Jobs fetched successfully", jobs });
}

export { createJob , getJobs };
