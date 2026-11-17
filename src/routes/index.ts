import { Router } from "express";

import { healthRouter } from "../modules/health/health.routes.js";
import { authRouter } from "./auth.routes.js";
import { jobRouter } from "./job.routes.js";
import {candidateRouter} from "./candidate.routes.js";
import { interviewRouter } from "./interview.routes.js";
import { inviteRouter } from "./invite.routes.js";
import { agentRouter } from "./agent.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/jobs", jobRouter); // Add this line to register the jobRouter
apiRouter.use("/candidates", candidateRouter); // Add this line to register the candidateRouter
// Must come before interviewRouter: its requireAuth runs for every /interviews request that reaches it.
apiRouter.use("/interviews", agentRouter); // voice agent only (x-agent-secret)
apiRouter.use("/interviews", interviewRouter); // recruiter only
apiRouter.use("/invites", inviteRouter); // public: candidates use their invite token

// Register feature modules here as they are added, e.g.:
// apiRouter.use("/interviews", interviewsRouter);

