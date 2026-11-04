import { z } from "zod";

import { env } from "../config/env.js";
import {
  CRITERIA,
  SCORE_LEVELS,
  competenciesFor,
  overallScore,
  recommendationFor,
  scoreQuestion,
} from "../config/scoring.js";
import { QUESTION_TYPES, type QuestionType } from "../models/interview.model.js";
import { HttpError } from "../utils/http-error.js";

// The only file that talks to the LLM providers. Switching providers means changing this file only.
// Questions come from OpenAI, evaluation from Groq. Groq's API is OpenAI-compatible, so both use
// the same request shape and a plain fetch is enough (no SDK needed).
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

// CVs are usually 1–3k words; the cap keeps a huge PDF from blowing up the prompt.
const MAX_RESUME_CHARS = 15_000;

type GenerateQuestionsInput = {
  job: { title: string; description: string };
  candidate: { name: string; experience: number; skills: string[]; resumeText: string };
  focus: "technical" | "behavioral" | "mixed";
  questionCount: number;
  maxMinutes: number;
  instructions?: string;
};

// Checks the model's reply at runtime too: the JSON schema guides the model, zod enforces it.
const questionsResponseSchema = z.object({
  // The model sometimes pads the array with stray "" entries between questions; drop non-objects first.
  questions: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "object" && item !== null) : value),
    z.array(
      z.object({
        text: z.string().trim().min(5),
        topic: z.string().trim().default(""),
        type: z.enum(QUESTION_TYPES),
        rubric: z.object({
          lookFor: z.array(z.string().trim().min(1)).min(1),
          redFlags: z.array(z.string().trim().min(1)).default([]),
        }),
      })
    ).min(1)
  ),
});

const FOCUS_GUIDE = {
  technical: "Focus on technical skills, tools and problem solving related to the role.",
  behavioral: "Focus on behavioral questions: teamwork, ownership, communication, handling challenges.",
  mixed: "Mix technical and behavioral questions, roughly half each.",
} as const;

const buildQuestionsPrompt = ({
  job,
  candidate,
  focus,
  questionCount,
  maxMinutes,
  instructions,
}: GenerateQuestionsInput) => `
You are preparing a spoken job interview that an AI voice interviewer will run.

Write exactly ${questionCount} interview questions for this candidate and role.
The whole interview lasts about ${maxMinutes} minutes, so each question must be answerable in 1–2 minutes.

Rules:
- ${FOCUS_GUIDE[focus]}
- Tailor questions to this candidate: refer to specific projects, roles or skills from the CV where useful.
- Check the job's key requirements, including ones the CV does not clearly show.
- Questions are spoken aloud: one clear question each, plain conversational language, no lists, no code.
- Order them from easier (warm-up about their background) to harder.
- Do not ask about age, religion, family, health, nationality or other protected characteristics.
- "topic" is a short label for what the question checks, e.g. "React" or "Teamwork".
- "type" is "technical" (knowledge, tools, problem solving) or "behavioral" (a past situation: teamwork,
  ownership, conflict). An intro/background question is "behavioral".

Each question also gets a "rubric" that a reviewer will later use to score the spoken answer:
- "lookFor": 2–4 specific, observable things a strong answer contains, tied to this question, this role and
  this CV (e.g. "explains why they chose Redux over Context in the e-commerce project"), not generic praise.
- "redFlags": 1–3 signs of a weak answer (e.g. "only describes what the team did, not their own part").
- Behavioral rubrics follow STAR: a specific situation, the candidate's own actions, and a clear result.
- Every rubric point must be something a candidate could actually say in a 1–2 minute spoken answer.

<job>
Title: ${job.title}
Description: ${job.description}
</job>

<candidate>
Name: ${candidate.name}
Years of experience: ${candidate.experience}
Listed skills: ${candidate.skills.join(", ") || "none listed"}
CV text:
${candidate.resumeText.slice(0, MAX_RESUME_CHARS)}
</candidate>
${
  instructions
    ? `
<recruiter_instructions>
Follow these extra instructions from the recruiter, as long as they don't break the rules above:
${instructions}
</recruiter_instructions>
`
    : ""
}`;

/** Asks the LLM for interview questions tailored to the candidate's CV and the job. */
const generateQuestions = async (input: GenerateQuestionsInput) => {
  let raw: string | undefined;

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [{ role: "user", content: buildQuestionsPrompt(input) }],
        temperature: 0.7,
        // Structured output: the model must return JSON in exactly this shape.
        // strict: OpenAI then guarantees the reply matches the schema.
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "interview_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      topic: { type: "string" },
                      type: { type: "string", enum: [...QUESTION_TYPES] },
                      rubric: {
                        type: "object",
                        properties: {
                          lookFor: { type: "array", items: { type: "string" } },
                          redFlags: { type: "array", items: { type: "string" } },
                        },
                        required: ["lookFor", "redFlags"],
                        additionalProperties: false,
                      },
                    },
                    required: ["text", "topic", "type", "rubric"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    raw = data.choices[0]?.message.content;
  } catch (err) {
    console.error("OpenAI request failed:", err);
    throw new HttpError(502, "Couldn't generate interview questions. Please try again.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw ?? "");
  } catch {
    json = undefined; // falls through to the format error below
  }

  const parsed = questionsResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("Unexpected OpenAI response:", raw);
    throw new HttpError(502, "The AI returned questions in an unexpected format. Please try again.");
  }

  return {
    questions: parsed.data.questions.slice(0, input.questionCount),
    model: env.OPENAI_MODEL,
  };
};

// ---------------- Evaluation ----------------

// No CV here on purpose: the rubrics were already tailored to the CV when the questions were written,
// and the evaluator should only judge what was said in the interview.
type EvaluateInterviewInput = {
  job: { title: string; description: string };
  questions: {
    text: string;
    topic: string;
    type: QuestionType;
    rubric: { lookFor: string[]; redFlags: string[] };
  }[];
  transcript: { role: "assistant" | "user"; text: string }[];
  endReason?: "completed" | "time_limit" | "candidate_left";
};

// Every criterion key across both question types, e.g. ["accuracy", "depth", ..., "situation", ...].
const CRITERION_KEYS = [...new Set(Object.values(CRITERIA).flatMap((list) => list.map((c) => c.key)))];

// The LLM only rates criteria and quotes evidence. Scores, recommendation and competencies come from
// config/scoring.ts. Ratings are rounded because the model sometimes returns 3.5.
const evaluationResponseSchema = z.object({
  questions: z.array(
    z.object({
      questionNumber: z.number().int().min(1),
      answered: z.boolean(),
      criteria: z.array(
        z.object({ name: z.string(), score: z.number().min(1).max(5).transform(Math.round) })
      ),
      evidence: z.array(z.string().trim().min(1)),
      comment: z.string().trim(),
    })
  ),
  summary: z.string().trim().min(10),
  strengths: z.array(z.string().trim().min(1)),
  concerns: z.array(z.string().trim().min(1)),
});

const END_REASON_NOTE = {
  completed: "The interview finished normally.",
  time_limit: "The interview was stopped by the time limit, so later questions may not have been reached.",
  candidate_left: "The candidate left before the interview finished.",
} as const;

// The transcript is rendered as a plain script; the model reads that more reliably than raw JSON.
const formatTranscript = (transcript: EvaluateInterviewInput["transcript"]) =>
  transcript.map((t) => `${t.role === "assistant" ? "Interviewer" : "Candidate"}: ${t.text}`).join("\n");

const formatList = (items: string[]) =>
  items.length ? items.map((item) => `  - ${item}`).join("\n") : "  - (none given, use the criteria only)";

// One block per question: its type decides the criteria, its rubric is the standard to score against.
const formatQuestion = (q: EvaluateInterviewInput["questions"][number], i: number) => `
Question ${i + 1} (${q.type}${q.topic ? `, topic: ${q.topic}` : ""})
"${q.text}"
Look for:
${formatList(q.rubric.lookFor)}
Red flags:
${formatList(q.rubric.redFlags)}
Criteria to rate: ${CRITERIA[q.type].map((c) => c.key).join(", ")}`;

const formatCriteria = () =>
  Object.entries(CRITERIA)
    .map(([type, list]) => `${type}:\n${list.map((c) => `  - ${c.key}: ${c.description}`).join("\n")}`)
    .join("\n");

const buildEvaluationPrompt = ({ job, questions, transcript, endReason }: EvaluateInterviewInput) => `
You are an experienced interviewer scoring the transcript of a spoken job interview run by an AI interviewer.
Score each question separately against its rubric. Do not decide an overall score or a hire/no-hire.

For every question below, return one entry with:
- "questionNumber": the question's number.
- "answered": false if the candidate never answered it (not asked, skipped, refused, or off-topic). Otherwise true.
- "criteria": rate EVERY criterion listed for that question from 1 to 5, using the scale below.
  The rubric's "Look for" points push a rating up, its "Red flags" push it down. Leave empty if not answered.
- "evidence": 1–3 short quotes copied word-for-word from the Candidate's lines that justify the ratings.
- "comment": one sentence on why, for a recruiter.

Then:
- "summary": 2–4 plain sentences for a recruiter on how the interview went.
- "strengths" and "concerns": 2–4 short points each, each grounded in something the candidate said.

Rules:
- Judge ONLY what the candidate said. Never give credit for something they didn't say.
- The interviewer may rephrase questions or ask follow-ups; a follow-up answer counts toward the question it follows.
- The transcript comes from speech-to-text: ignore filler words, grammar slips and transcription errors.
- Never consider age, gender, religion, family, health, nationality, accent or other protected characteristics.
- ${END_REASON_NOTE[endReason ?? "completed"]}

<scale>
${Object.entries(SCORE_LEVELS)
  .map(([level, text]) => `${level} = ${text}`)
  .join("\n")}
</scale>

<criteria>
${formatCriteria()}
</criteria>

<job>
Title: ${job.title}
Description: ${job.description}
</job>

<questions>
${questions.map(formatQuestion).join("\n")}
</questions>

<transcript>
${formatTranscript(transcript)}
</transcript>`;

// Drops any "quote" that isn't actually in the candidate's answers, so the recruiter never sees
// invented evidence. Case, punctuation and spacing are ignored when comparing.
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const keepRealQuotes = (quotes: string[], transcript: EvaluateInterviewInput["transcript"]) => {
  const candidateText = normalize(
    transcript
      .filter((t) => t.role === "user")
      .map((t) => t.text)
      .join(" ")
  );
  return quotes.filter((quote) => normalize(quote) && candidateText.includes(normalize(quote)));
};

/** Asks the LLM to score a finished interview from its transcript. */
const evaluateInterview = async (input: EvaluateInterviewInput) => {
  let raw: string | undefined;

  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [{ role: "user", content: buildEvaluationPrompt(input) }],
        // Low temperature: grading should be consistent, not creative.
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "interview_evaluation",
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      questionNumber: { type: "integer" },
                      answered: { type: "boolean" },
                      criteria: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string", enum: CRITERION_KEYS },
                            score: { type: "integer" },
                          },
                          required: ["name", "score"],
                          additionalProperties: false,
                        },
                      },
                      evidence: { type: "array", items: { type: "string" } },
                      comment: { type: "string" },
                    },
                    required: ["questionNumber", "answered", "criteria", "evidence", "comment"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                concerns: { type: "array", items: { type: "string" } },
              },
              required: ["questions", "summary", "strengths", "concerns"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    raw = data.choices[0]?.message.content;
  } catch (err) {
    console.error("Groq request failed:", err);
    throw new HttpError(502, "Couldn't evaluate the interview. Please try again.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw ?? "");
  } catch {
    json = undefined; // falls through to the format error below
  }

  const parsed = evaluationResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("Unexpected Groq response:", raw);
    throw new HttpError(502, "The AI returned the evaluation in an unexpected format. Please try again.");
  }

  // From here on it's plain code: the rules in config/scoring.ts turn ratings into scores.
  // Walk OUR question list (not the LLM's), so a question the LLM skipped still counts, as unanswered.
  const questionScores = input.questions.map((question, index) => {
    const rated = parsed.data.questions.find((q) => q.questionNumber === index + 1);
    const answered = rated?.answered ?? false;

    // Keep only this question type's criteria, in a fixed order; a missing rating counts as 1.
    const criteria = answered
      ? CRITERIA[question.type].map((c) => ({
          name: c.key,
          score: rated?.criteria.find((r) => r.name === c.key)?.score ?? 1,
        }))
      : [];

    return {
      questionIndex: index,
      answered,
      criteria,
      score: scoreQuestion(question.type, answered, criteria),
      evidence: keepRealQuotes(rated?.evidence ?? [], input.transcript),
      comment: rated?.comment ?? "Not answered.",
    };
  });

  const score = overallScore(questionScores.map((q) => q.score));

  return {
    evaluation: {
      score,
      recommendation: recommendationFor(score),
      summary: parsed.data.summary,
      questionScores,
      competencies: competenciesFor(input.questions, questionScores),
      strengths: parsed.data.strengths,
      concerns: parsed.data.concerns,
    },
    model: env.GROQ_MODEL,
  };
};

export { generateQuestions, evaluateInterview };
export type { GenerateQuestionsInput, EvaluateInterviewInput };
