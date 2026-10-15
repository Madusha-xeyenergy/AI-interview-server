import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";

import { env } from "../config/env.js";

// The only file that talks to LiveKit. The REST API uses http(s); clients connect with ws(s).
// ws:// (local dev server, no TLS) maps to http://, wss:// (LiveKit Cloud) maps to https://.
const livekitHttpUrl = env.LIVEKIT_URL.replace(/^ws(s?):\/\//, "http$1://");
const dispatchClient = new AgentDispatchClient(livekitHttpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
const roomClient = new RoomServiceClient(livekitHttpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

// ParticipantInfo_Kind.AGENT in @livekit/protocol (not re-exported by livekit-server-sdk).
const PARTICIPANT_KIND_AGENT = 4;

/** Data the agent reads from ctx.job.metadata (InterviewMeta in interview-agent/src/agent.ts). */
type InterviewMeta = {
  interviewId: string;
  candidateName: string;
  jobTitle: string;
  questions: string[];
  maxMinutes: number;
};

/** A short-lived token that lets one candidate join one room, and nothing else. */
const createCandidateToken = async (roomName: string, identity: string, name: string, ttlMinutes: number) => {
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: `${ttlMinutes}m`,
  });
  token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

  return await token.toJwt();
};

/** Sends the interviewer agent into the room (creating the room if needed) with the interview data. */
const dispatchInterviewer = async (roomName: string, meta: InterviewMeta) => {
  return await dispatchClient.createDispatch(roomName, env.LIVEKIT_AGENT_NAME, {
    metadata: JSON.stringify(meta),
  });
};

/**
 * True if an agent is currently in the room. False if the room is gone: LiveKit closes a room
 * once everyone has left, e.g. after the agent ended its job when the candidate disconnected.
 */
const isAgentInRoom = async (roomName: string) => {
  try {
    const participants = await roomClient.listParticipants(roomName);
    return participants.some((participant) => participant.kind === PARTICIPANT_KIND_AGENT);
  } catch {
    return false; // "requested room does not exist"
  }
};

export { createCandidateToken, dispatchInterviewer, isAgentInRoom };
export type { InterviewMeta };
