import { env } from "../config/env.js";
import { InterviewModel } from "../models/interview.model.js";
import { HttpError } from "../utils/http-error.js";
import { hashInviteToken } from "../utils/invite-token.js";
import { createCandidateToken, dispatchInterviewer, isAgentInRoom } from "./livekitService.js";

// Candidate-facing logic. Candidates never log in: the invite token in their link is their only access.

// createInviteToken makes 32 random bytes → always 43 base64url characters.
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Extra minutes on the candidate's LiveKit token beyond the interview length (late join, reconnects).
const TOKEN_GRACE_MINUTES = 15;

/** Finds the interview behind an invite link and checks it can still be used. */
const findInterviewByToken = async (token: string) => {
  // A malformed token can't match any hash, so skip the database.
  if (!INVITE_TOKEN_PATTERN.test(token)) {
    throw new HttpError(404, "This interview link is invalid");
  }

  const interview = await InterviewModel.findOne({ inviteTokenHash: hashInviteToken(token) })
    .populate<{ candidateId: { name: string } }>("candidateId", "name")
    .populate<{ jobId: { title: string } }>("jobId", "title");

  if (!interview) {
    throw new HttpError(404, "This interview link is invalid");
  }

  if (interview.status === "cancelled") {
    throw new HttpError(410, "This interview has been cancelled");
  }
  if (interview.status === "completed") {
    throw new HttpError(410, "This interview has already been completed");
  }

  // Expiry is checked when the link is opened, so no cron job is needed.
  if (interview.status === "pending" && interview.inviteExpiresAt < new Date()) {
    interview.status = "expired";
    await interview.save();
  }
  if (interview.status === "expired") {
    throw new HttpError(410, "This interview link has expired");
  }

  return interview; // "pending" or "in_progress" (a candidate whose connection dropped can rejoin)
};

// GET /api/invites/:token: what the candidate's start page shows. No questions, ids or CV data.
const getInviteService = async (token: string) => {
  const interview = await findInterviewByToken(token);

  return {
    status: interview.status,
    candidateName: interview.candidateId?.name ?? "",
    jobTitle: interview.jobId?.title ?? "",
    focus: interview.focus,
    maxMinutes: interview.maxMinutes,
    questionCount: interview.questionCount,
    expiresAt: interview.inviteExpiresAt,
  };
};

// POST /api/invites/:token/start: dispatches the AI interviewer and returns what the browser needs to join.
const startInterviewService = async (token: string) => {
  const interview = await findInterviewByToken(token);
  const interviewId = interview._id.toString();
  const candidateName = interview.candidateId?.name ?? "Candidate";

  // `||` (not `??`): an empty roomName, e.g. after a manual reset in Atlas, also means "not set".
  const roomName = interview.roomName || `interview-${interviewId}`;

  // Send the agent in on the first start, and on a rejoin when the agent is no longer there
  // (it ends its job when the candidate disconnects, and LiveKit then closes the empty room).
  const needsAgent = interview.status === "pending" || !(await isAgentInRoom(roomName));

  if (needsAgent) {
    try {
      await dispatchInterviewer(roomName, {
        interviewId,
        candidateName,
        jobTitle: interview.jobId?.title ?? "",
        questions: interview.questions.map((question) => question.text), // from the DB, never the browser
        maxMinutes: interview.maxMinutes,
      });
    } catch (err) {
      // Nothing is saved, so the candidate can simply try again.
      console.error(`[${interviewId}] agent dispatch failed:`, err);
      throw new HttpError(502, "Couldn't start the interview. Please try again.");
    }

    if (interview.status === "pending") {
      interview.status = "in_progress";
      interview.startedAt = new Date(); // first start only; a re-dispatch keeps the original time
    }
    interview.roomName = roomName;
    await interview.save();
  }

  const participantToken = await createCandidateToken(
    roomName,
    `candidate-${interviewId}`,
    candidateName,
    interview.maxMinutes + TOKEN_GRACE_MINUTES
  );

  return { serverUrl: env.LIVEKIT_URL, roomName, participantToken };
};

export { findInterviewByToken, getInviteService, startInterviewService };
