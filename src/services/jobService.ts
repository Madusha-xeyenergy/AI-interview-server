import { Job } from "../models/job.models.js";
import type { CreateJobInput } from "../validators/job.validators.js";

// createBy always comes from the logged-in user, never from the request body.
const createJobService = async (jobInput: CreateJobInput, userId: string) => {
  const job = new Job({
    ...jobInput,
    createBy: userId,
  });
  return await job.save();
};

const getJobsService = async () => {
  return await Job.find().sort({ createdAt: -1 });
};


export { createJobService, getJobsService };
