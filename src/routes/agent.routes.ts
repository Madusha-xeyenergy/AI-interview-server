import { Router } from "express";

import { saveTranscript } from "../controllers/interviewController.js";
import { requireAgentSecret } from "../middleware/agentAuth.js";

// Server-to-server router for the voice agent (interview-agent). It has no login cookie,
// so every route here is protected by the shared AGENT_SECRET instead.
const agentRouter = Router();

agentRouter.post("/:id/transcript", requireAgentSecret, saveTranscript);

export { agentRouter };
