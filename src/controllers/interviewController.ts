import type { Request, Response } from "express";

import {
  createInterviewService,
  evaluateInterviewService,
  getInterviewByIdService,
  getInterviewsService,
  previewQuestionsService,
  saveTranscriptService,
} from "../services/interviewService.js";
import { HttpError } from "../utils/http-error.js";
import {
  createInterviewSchema,
  generateQuestionsSchema,
  interviewIdParamSchema,
  saveTranscriptSchema,
} from "../validators/interview.validator.js";

// POST /api/interviews/questions: AI questions for the recruiter to review and edit. Nothing is saved.
const previewQuestions = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated");
  }

  const input = generateQuestionsSchema.parse(req.body); // invalid body → ZodError → 422 via error-handler
  const { questions, model } = await previewQuestionsService(input);

  res.status(200).json({ questions, model });
};

// POST /api/interviews: saves the interview with the final questions and returns the candidate's invite link.
const createInterview = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated");
  }

  const input = createInterviewSchema.parse(req.body);
  const { interview, inviteUrl } = await createInterviewService(input, req.user.id);

  res.status(201).json({ message: "Interview created successfully", interview, inviteUrl });
};

// POST /api/interviews/:id/transcript: called by the voice agent, not a recruiter.
// No req.user here: requireAgentSecret (agent.routes.ts) has already checked the x-agent-secret header.
const saveTranscript = async (req: Request, res: Response) => {
  const { id } = interviewIdParamSchema.parse(req.params);
  const input = saveTranscriptSchema.parse(req.body);
  const { status, entries } = await saveTranscriptService(id, input);

  // Evaluate in the background, NOT awaited: the agent gets its response right away, and a slow or
  // failed LLM call can never lose the transcript. A failure is only logged; the recruiter can retry.
  if (status === "completed") {
    evaluateInterviewService(id).catch((err) => console.error(`Evaluation failed for interview ${id}:`, err));
  }

  res.status(200).json({ message: "Transcript saved successfully", status, entries });
};

// POST /api/interviews/:id/evaluate: the recruiter (re-)runs the evaluation, e.g. after a failure.
// Awaited, so the response carries the new evaluation (takes a few seconds).
const runEvaluation = async (req: Request, res: Response) => {
  const { id } = interviewIdParamSchema.parse(req.params);
  const evaluation = await evaluateInterviewService(id);

  res.status(200).json({ message: "Interview evaluated successfully", evaluation });
};

// GET /api/interviews: get all interviews.
const getInterviews = async (req: Request, res: Response) => {
  const interviews = await getInterviewsService();
  res.status(200).json({ interviews });
};

// GET /api/interviews/:id: one interview with transcript and evaluation.
const getInterview = async (req: Request, res: Response) => {
  const { id } = interviewIdParamSchema.parse(req.params);
  const interview = await getInterviewByIdService(id);
  res.status(200).json({ interview });
};

export { previewQuestions, createInterview, saveTranscript, runEvaluation, getInterviews, getInterview };
