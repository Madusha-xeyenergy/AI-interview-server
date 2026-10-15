import { Schema, model, Document } from "mongoose";

export const JOB_STATUS = ["open", "closed", "in_progress"] as const;
export const JOB_TYPES = ["full_time", "part_time", "contract"] as const;
export const JOB_MODES = ["remote", "on_site", "hybrid"] as const;

export interface IJob {
  title: string;
  description: string;
  status: typeof JOB_STATUS[number];
  type: typeof JOB_TYPES[number];
  mode: typeof JOB_MODES[number];
  createBy: string;
  
}

const jobSchema =  new Schema<IJob>(
    {
      title: { type: String, required: true },
      description: { type: String, required: true },
      status: { type: String, enum: JOB_STATUS, required: true },
      type: { type: String, enum: JOB_TYPES, required: true },
      mode: { type: String, enum: JOB_MODES, required: true },
      createBy: { type: String, required: true, timestamps: true },
       
    }
)

export const Job = model<IJob>("Job", jobSchema);
