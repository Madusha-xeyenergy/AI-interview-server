import { HydratedDocument, InferSchemaType, Schema, model } from "mongoose";

const candidateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    experience: { type: Number, required: true, min: 0 }, // years
    skills: { type: [String], default: [] },

    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },

    // The original CV file, stored in the GridFS "resumes" bucket.
    resume: {
      fileId: { type: Schema.Types.ObjectId, required: true },
      filename: { type: String, required: true },
      contentType: { type: String, required: true },
      size: { type: Number, required: true },
    },

    // Plain text pulled from the CV; this is what the LLM reads when writing questions.
    // select: false → large, so only loaded with .select("+resumeText")
    resumeText: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

// The same person can apply to several jobs, but only once per job.
candidateSchema.index({ jobId: 1, email: 1 }, { unique: true });

export type Candidate = InferSchemaType<typeof candidateSchema>;
export type CandidateDocument = HydratedDocument<Candidate>;

export const CandidateModel = model("Candidate", candidateSchema);
