import {z} from "zod";
import { JOB_STATUS } from "../models/job.models.js";
import { JOB_TYPES } from "../models/job.models.js";
import { JOB_MODES } from "../models/job.models.js";




const createJobSchema = z.object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().min(1, "Description is required"),
    status: z.enum(JOB_STATUS, "Invalid job status"),
    type: z.enum(JOB_TYPES, "Invalid job type"),
    mode: z.enum(JOB_MODES, "Invalid job mode"),
    // createBy is not accepted from the client; the service sets it from req.user.
});


export type CreateJobInput = z.infer<typeof createJobSchema>;
export { createJobSchema };