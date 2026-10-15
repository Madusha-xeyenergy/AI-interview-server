import { Router } from "express";

import { getInvite, startInterview } from "../controllers/inviteController.js";

// Public router for candidates. Every route here must look up the interview by invite token;
// never add a route that exposes interview data without one.
const inviteRouter = Router();

inviteRouter.get("/:token", getInvite);
inviteRouter.post("/:token/start", startInterview);

export { inviteRouter };
