import type { Request, Response } from "express";

import { getInviteService, startInterviewService } from "../services/inviteService.js";

// Public candidate endpoints: access comes from the invite token in the URL, not a login.

// GET /api/invites/:token: the candidate opens their invite link.
const getInvite = async (req: Request<{ token: string }>, res: Response) => {
  const invite = await getInviteService(req.params.token);
  res.status(200).json({ invite });
};

// POST /api/invites/:token/start: the candidate clicks "Start interview".
const startInterview = async (req: Request<{ token: string }>, res: Response) => {
  const session = await startInterviewService(req.params.token);
  res.status(200).json(session);
};



export { getInvite, startInterview };
