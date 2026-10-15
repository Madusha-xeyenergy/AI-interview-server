import { env } from "../config/env.js";
import { CandidateModel } from "../models/candidate.model.js";
import { InterviewModel } from "../models/interview.model.js";
import { Job } from "../models/job.models.js";
import { HttpError } from "../utils/http-error.js";
import { createInviteToken } from "../utils/invite-token.js";
import type {
  CreateInterviewInput,
  GenerateQuestionsInput,
  SaveTranscriptInput,
} from "../validators/interview.validator.js";
import { evaluateInterview, generateQuestions } from "./llmService.js";

const INVITE_TTL_DAYS = 7;

// Never trust ids from the browser: both must exist. resumeText is select: false, so ask for it.
const loadJobAndCandidate = async (jobId: string, candidateId: string) => {
  const [job, candidate] = await Promise.all([
    Job.findById(jobId),
    CandidateModel.findById(candidateId).select("+resumeText"),
  ]);

  if (!job) {
    throw new HttpError(404, "Job not found");
  }
  if (!candidate) {
    throw new HttpError(404, "Candidate not found");
  }
  return { job, candidate };
};

// Step 1 ("Generate questions" button): returns AI questions for the recruiter to review. Saves nothing.
const previewQuestionsService = async (input: GenerateQuestionsInput) => {
  const { job, candidate } = await loadJobAndCandidate(input.jobId, input.candidateId);

  return await generateQuestions({
    job: { title: job.title, description: job.description },
    candidate: {
      name: candidate.name,
      experience: candidate.experience,
      skills: candidate.skills,
      resumeText: candidate.resumeText,
    },
    focus: input.focus,
    questionCount: input.questionCount,
    maxMinutes: input.maxMinutes,
    instructions: input.instructions,
  });
};

// Step 2 ("Create & Send Invitation"): saves the interview with the final questions and returns the invite link.
const createInterviewService = async (input: CreateInterviewInput, userId: string) => {
  await loadJobAndCandidate(input.jobId, input.candidateId);

  const { token, tokenHash } = createInviteToken();

  const interview = await InterviewModel.create({
    ...input,
    questionCount: input.questions.length,
    createdBy: userId,
    inviteTokenHash: tokenHash,
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  // The raw token is only ever returned here, inside the link. The hash never leaves the server.
  const { inviteTokenHash: _omit, ...publicInterview } = interview.toObject();

  return {
    interview: publicInterview,
    inviteUrl: `${env.APP_URL}/interview/${token}`,
  };
};

// Called by the voice agent when its job ends (POST /api/interviews/:id/transcript).
const saveTranscriptService = async (interviewId: string, input: SaveTranscriptInput) => {
  const interview = await InterviewModel.findById(interviewId);

  if (!interview) {
    throw new HttpError(404, "Interview not found");
  }
  if (interview.status !== "in_progress") {
    // e.g. the agent retried after the interview was already completed
    throw new HttpError(409, `Interview is ${interview.status}, transcript not accepted`);
  }

  // Append, don't replace: if the candidate drops and rejoins, a new agent job sends the next part.
  interview.transcript.push(...input.transcript);
  interview.endReason = input.endReason;

  // "candidate_left" keeps the interview in_progress, so the invite link still allows a rejoin.
  if (input.endReason === "completed" || input.endReason === "time_limit") {
    interview.status = "completed";
    interview.completedAt = new Date();
  }

  await interview.save();

  return { status: interview.status, entries: interview.transcript.length };
};

// Scores a completed interview against its question rubrics and saves the result.
// Runs automatically after the agent's final transcript, or again from POST /api/interviews/:id/evaluate.
const evaluateInterviewService = async (interviewId: string) => {
  const interview = await InterviewModel.findById(interviewId);

  if (!interview) {
    throw new HttpError(404, "Interview not found");
  }
  if (interview.status !== "completed") {
    throw new HttpError(409, `Interview is ${interview.status}, it can only be evaluated once completed`);
  }
  if (!interview.transcript.some((entry) => entry.role === "user")) {
    throw new HttpError(409, "The candidate didn't say anything, so there is nothing to evaluate");
  }

  const job = await Job.findById(interview.jobId);
  if (!job) {
    throw new HttpError(404, "Job not found");
  }

  // Plain objects only: the LLM service shouldn't depend on Mongoose documents.
  const { evaluation, model } = await evaluateInterview({
    job: { title: job.title, description: job.description },
    questions: interview.questions.map((question) => ({
      text: question.text,
      topic: question.topic,
      type: question.type,
      rubric: {
        lookFor: [...(question.rubric?.lookFor ?? [])],
        redFlags: [...(question.rubric?.redFlags ?? [])],
      },
    })),
    transcript: interview.transcript.map((entry) => ({ role: entry.role, text: entry.text })),
    endReason: interview.endReason ?? undefined,
  });

  // Re-evaluating replaces the previous result; evaluatedAt shows when it was last run.
  // .set() instead of `=`: Mongoose casts the plain arrays into subdocuments (and its types expect that).
  interview.set("evaluation", { ...evaluation, evaluatedBy: model, evaluatedAt: new Date() });
  await interview.save();

  return interview.evaluation;
};


// List view: skip transcript/questions (large, and the list doesn't show them).
const getInterviewsService = async () => {
  return await InterviewModel.find()
    .select("-transcript -questions")
    .populate<{ candidateId: { name: string; email: string } }>("candidateId", "name email")
    .populate<{ jobId: { title: string } }>("jobId", "title")
    .sort({ createdAt: -1 });
};


// Detail view: everything, including transcript, questions and evaluation.
// inviteTokenHash is select: false, so it's never included.
const getInterviewByIdService = async (id: string) => {
  const interview = await InterviewModel.findById(id)
    .populate<{ candidateId: { name: string; email: string } }>("candidateId", "name email")
    .populate<{ jobId: { title: string } }>("jobId", "title");

  if (!interview) {
    throw new HttpError(404, "Interview not found");
  }
  return interview;
};

export {
  previewQuestionsService,
  createInterviewService,
  saveTranscriptService,
  evaluateInterviewService,
  getInterviewsService,
  getInterviewByIdService,
};
