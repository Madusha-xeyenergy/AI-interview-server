import type { QuestionType } from "../models/interview.model.js";

// The fixed scoring rules for every interview. The LLM only rates each criterion 1–5 against the
// question's rubric; everything below (weights, maths, thresholds) is decided here, in code.
// Changing how candidates are scored means changing this file only.

type Criterion = {
  key: string; // what the LLM returns and what's stored in questionScores.criteria[].name
  label: string; // shown to recruiters
  description: string; // what the LLM is judging
  weight: number; // relative importance within the question
};

// Shared 1–5 scale. Fixed wording keeps a "4" meaning the same thing in every interview.
const SCORE_LEVELS = {
  1: "Not demonstrated: no answer, wrong, or off-topic.",
  2: "Weak: vague or generic, with clear gaps or mistakes.",
  3: "Adequate: correct and relevant, but surface-level.",
  4: "Strong: specific and well-reasoned, backed by concrete examples.",
  5: "Exceptional: expert-level depth, explains trade-offs or measurable results.",
} as const;

const COMMUNICATION: Criterion = {
  key: "communication",
  label: "Communication",
  description: "Clear, structured and easy to follow. Ignore speech-to-text errors and filler words.",
  weight: 1,
};

const CRITERIA: Record<QuestionType, Criterion[]> = {
  technical: [
    {
      key: "accuracy",
      label: "Technical accuracy",
      description: "What they say is technically correct.",
      weight: 3,
    },
    {
      key: "depth",
      label: "Depth of understanding",
      description: "Explains why, not just what: reasoning, trade-offs, alternatives.",
      weight: 2,
    },
    {
      key: "problem_solving",
      label: "Problem solving",
      description: "Breaks the problem down and reaches a sensible approach.",
      weight: 2,
    },
    COMMUNICATION,
  ],
  // STAR: Situation/Task, Action, Result.
  behavioral: [
    {
      key: "situation",
      label: "Situation & task",
      description: "Describes a real, specific situation and what they had to achieve.",
      weight: 1,
    },
    {
      key: "action",
      label: "Actions & ownership",
      description: "Concrete steps THEY took (not just the team), and why.",
      weight: 3,
    },
    {
      key: "result",
      label: "Result & learning",
      description: "Clear outcome, ideally measurable, and what they learned.",
      weight: 2,
    },
    COMMUNICATION,
  ],
};

// Overall score → recommendation. Same bands as the frontend's colours (80 / 65).
const RECOMMENDATION_THRESHOLDS = [
  { min: 80, recommendation: "strong_hire" },
  { min: 65, recommendation: "hire" },
  { min: 40, recommendation: "maybe" },
  { min: 0, recommendation: "no_hire" },
] as const;

type CriterionScore = { name: string; score: number };

/**
 * Weighted average of the 1–5 criterion scores, mapped to 0–100 (1 → 0, 3 → 50, 5 → 100).
 * An unanswered question is 0. A criterion the LLM left out counts as 1, the lowest score.
 */
const scoreQuestion = (type: QuestionType, answered: boolean, criteria: CriterionScore[]) => {
  if (!answered) return 0;

  let total = 0;
  let totalWeight = 0;
  for (const criterion of CRITERIA[type]) {
    const given = criteria.find((c) => c.name === criterion.key)?.score ?? 1;
    total += given * criterion.weight;
    totalWeight += criterion.weight;
  }

  const average = total / totalWeight; // 1–5
  return Math.round(((average - 1) / 4) * 100);
};

/** Every question counts equally, so skipping one costs the same whichever it is. */
const overallScore = (questionScores: number[]) => {
  if (questionScores.length === 0) return 0;
  return Math.round(questionScores.reduce((sum, s) => sum + s, 0) / questionScores.length);
};

const recommendationFor = (score: number) =>
  RECOMMENDATION_THRESHOLDS.find((t) => score >= t.min)!.recommendation;

/** One competency per question topic (questions sharing a topic are averaged), in question order. */
const competenciesFor = (
  questions: { topic: string; type: QuestionType }[],
  questionScores: { questionIndex: number; score: number }[]
) => {
  const byTopic = new Map<string, number[]>();

  for (const { questionIndex, score } of questionScores) {
    const question = questions[questionIndex];
    if (!question) continue;
    const name = question.topic || (question.type === "technical" ? "Technical" : "Behavioral");
    byTopic.set(name, [...(byTopic.get(name) ?? []), score]);
  }

  return [...byTopic].map(([name, scores]) => ({ name, score: overallScore(scores) }));
};

export { CRITERIA, SCORE_LEVELS, scoreQuestion, overallScore, recommendationFor, competenciesFor };
export type { Criterion, CriterionScore };
