import { HydratedDocument, InferSchemaType, Schema, model } from "mongoose";

export const INTERVIEW_STATUSES = ["pending", "in_progress", "completed", "expired", "cancelled"] as const;
export const INTERVIEW_FOCUS = ["technical", "behavioral", "mixed"] as const;
// Sent by the voice agent when the interview ends (interview-agent/src/agent.ts).
export const END_REASONS = ["completed", "time_limit", "candidate_left"] as const;
export const RECOMMENDATIONS = ["strong_hire", "hire", "maybe", "no_hire"] as const;
// Decides which scoring criteria apply to a question (see config/scoring.ts).
export const QUESTION_TYPES = ["technical", "behavioral"] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];
export type InterviewFocus = (typeof INTERVIEW_FOCUS)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];

// What a good answer to one specific question contains. Written by the LLM with the question,
// reviewed by the recruiter, and used by the evaluator as the standard to score against.
const rubricSchema = new Schema(
  {
    lookFor: { type: [String], default: [] }, // e.g. "explains why they chose Redux"
    redFlags: { type: [String], default: [] }, // e.g. "can't describe their own role"
  },
  { _id: false }
);

// _id: false → subdocuments in arrays don't get their own ids.
const questionSchema = new Schema(
  {
    text: { type: String, required: true },
    topic: { type: String, default: "" }, // e.g. "React", "Teamwork"
    type: { type: String, enum: QUESTION_TYPES, default: "technical" },
    rubric: { type: rubricSchema, default: () => ({}) },
  },
  { _id: false }
);

// One entry per question. The LLM fills criteria + evidence; `score` is computed in code from the criteria.
const questionScoreSchema = new Schema(
  {
    questionIndex: { type: Number, required: true }, // position in `questions`
    answered: { type: Boolean, required: true },
    criteria: {
      type: [{ name: { type: String, required: true }, score: { type: Number, min: 1, max: 5, required: true } }],
      default: [],
    },
    score: { type: Number, min: 0, max: 100, required: true },
    evidence: { type: [String], default: [] }, // short quotes from the candidate's answer
    comment: { type: String, default: "" },
  },
  { _id: false }
);

// Same shape the agent POSTs: { role, text, at }.
const transcriptEntrySchema = new Schema(
  {
    role: { type: String, enum: ["assistant", "user"], required: true },
    text: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

// Written after the transcript arrives. score, recommendation and competencies are computed in code
// from questionScores; summary, strengths and concerns are written by the LLM.
const evaluationSchema = new Schema(
  {
    score: { type: Number, min: 0, max: 100, required: true },
    recommendation: { type: String, enum: RECOMMENDATIONS, required: true },
    summary: { type: String, required: true },
    questionScores: { type: [questionScoreSchema], default: [] },
    competencies: {
      type: [{ name: { type: String, required: true }, score: { type: Number, min: 0, max: 100 } }],
      default: [],
    },
    strengths: { type: [String], default: [] },
    concerns: { type: [String], default: [] },
    evaluatedBy: { type: String, required: true }, // model id
    evaluatedAt: { type: Date, required: true },
  },
  { _id: false }
);

const interviewSchema = new Schema(
  {
    candidateId: { type: Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Settings chosen by the recruiter
    focus: { type: String, enum: INTERVIEW_FOCUS, default: "mixed" },
    maxMinutes: { type: Number, min: 1, max: 60, default: 15 }, // the agent's hard time limit
    questionCount: { type: Number, min: 1, max: 15, default: 5 },
    instructions: { type: String, default: "" }, // extra guidance from the recruiter

    // Written by the LLM from the CV + job description
    questions: { type: [questionSchema], default: [] },
    questionsGeneratedBy: { type: String }, // model id

    // Only the SHA-256 hash is stored; the raw token exists only in the invite link.
    // select: false → never loaded unless a query asks for it with .select("+inviteTokenHash")
    inviteTokenHash: { type: String, required: true, unique: true, select: false },
    inviteExpiresAt: { type: Date, required: true },

    // Lifecycle
    status: { type: String, enum: INTERVIEW_STATUSES, default: "pending" },
    startedAt: { type: Date },
    completedAt: { type: Date },
    endReason: { type: String, enum: END_REASONS },
    roomName: { type: String }, // LiveKit room

    // Results
    transcript: { type: [transcriptEntrySchema], default: [] },
    evaluation: { type: evaluationSchema },
  },
  { timestamps: true }
);

export type Interview = InferSchemaType<typeof interviewSchema>;
export type InterviewDocument = HydratedDocument<Interview>;

export const InterviewModel = model("Interview", interviewSchema);
