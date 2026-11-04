import { z } from "zod";

import { END_REASONS, INTERVIEW_FOCUS, QUESTION_TYPES } from "../models/interview.model.js";

const objectId = (label: string) => z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label} id`);

// Fields shared by "generate questions" and "create interview".
const interviewSettings = {
  jobId: objectId("job"),
  candidateId: objectId("candidate"),
  focus: z.enum(INTERVIEW_FOCUS, "Invalid interview focus"),
  maxMinutes: z.number().int().min(5).max(60),
  instructions: z.string().trim().max(1000).default(""),
};

// POST /api/interviews/questions: preview only, nothing is saved.
const generateQuestionsSchema = z.object({
  ...interviewSettings,
  questionCount: z.number().int().min(1).max(15),
});

// POST /api/interviews: the recruiter's final (possibly edited) questions.
const createInterviewSchema = z.object({
  ...interviewSettings,
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(5, "Question is too short").max(500),
        topic: z.string().trim().max(100).default(""),
        type: z.enum(QUESTION_TYPES, "Invalid question type").default("technical"),
        // Optional so hand-written questions (no rubric yet) are still accepted.
        rubric: z
          .object({
            lookFor: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
            redFlags: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
          })
          .default({ lookFor: [], redFlags: [] }),
      })
    )
    .min(1, "Add at least one question")
    .max(15, "At most 15 questions"),
  questionsGeneratedBy: z.string().trim().max(100).optional(), // model id, if AI-generated
});

// POST /api/interviews/:id/transcript: sent by the voice agent when its job ends.
const interviewIdParamSchema = z.object({ id: objectId("interview") });

const saveTranscriptSchema = z.object({
  endReason: z.enum(END_REASONS, "Invalid end reason"),
  transcript: z
    .array(
      z.object({
        role: z.string(),
        text: z.string().trim().max(5000),
        at: z.coerce.date(), // the agent sends ISO strings
      })
    )
    .max(500)
    // Keep only candidate/interviewer lines. Dropping a stray entry is better than rejecting the whole interview.
    .transform((entries) =>
      entries.filter(
        (entry): entry is { role: "assistant" | "user"; text: string; at: Date } =>
          (entry.role === "assistant" || entry.role === "user") && entry.text.length > 0
      )
    ),
  // Missing when the agent couldn't start a recording. A malformed one is dropped, not rejected:
  // losing the recording link is better than losing the transcript.
  recording: z
    .object({ egressId: z.string().min(1).max(100), file: z.string().min(1).max(500) })
    .optional()
    .catch(undefined),
});

export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type SaveTranscriptInput = z.infer<typeof saveTranscriptSchema>;
export { generateQuestionsSchema, createInterviewSchema, interviewIdParamSchema, saveTranscriptSchema };
