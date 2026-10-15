import { mongo } from "mongoose";

import { CandidateModel } from "../models/candidate.model.js";
import { Job } from "../models/job.models.js";
import { deleteResumeFile, saveResumeFile } from "../utils/gridfs.js";
import { HttpError } from "../utils/http-error.js";
import { extractPdfText } from "../utils/pdf-text.js";
import type { ApplyCandidateInput } from "../validators/candidate.validator.js";

type CvFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

const getCandidatesService = async () => {
  return await CandidateModel.find().populate("jobId", "title").sort({ createdAt: -1 });
};

const getCandidateByIdService = async (id: string) => {
  const candidate = await CandidateModel.findById(id).populate("jobId", "title");
  if (!candidate) {
    throw new HttpError(404, "Candidate not found");
  }
  return candidate;
};

// A candidate applies for a job: validate the job, read the CV text, store the file, save the candidate.
const applyCandidateService = async (input: ApplyCandidateInput, cv: CvFile) => {
  const job = await Job.findById(input.jobId);
  if (!job) {
    throw new HttpError(404, "Job not found");
  }
  if (job.status !== "open") {
    throw new HttpError(400, "This job is not accepting applications");
  }

  // Extract first: if the PDF is unreadable, nothing gets stored.
  const resumeText = await extractPdfText(cv.buffer).catch(() => "");
  if (!resumeText) {
    throw new HttpError(422, "Couldn't read text from this PDF. Is it a scanned image?");
  }

  const fileId = await saveResumeFile(cv.buffer, cv.originalname, cv.mimetype);

  try {
    const candidate = await CandidateModel.create({
      ...input,
      resume: { fileId, filename: cv.originalname, contentType: cv.mimetype, size: cv.size },
      resumeText,
    });

    // resumeText stays server-side; it is only for the LLM.
    const { resumeText: _omit, ...publicCandidate } = candidate.toObject();
    return publicCandidate;
  } catch (err) {
    // The candidate wasn't saved, so remove the file to avoid an orphan in GridFS.
    await deleteResumeFile(fileId).catch(() => undefined);

    if (err instanceof mongo.MongoServerError && err.code === 11000) {
      throw new HttpError(409, "You have already applied for this job");
    }
    throw err;
  }
};

export { getCandidatesService, getCandidateByIdService, applyCandidateService };
