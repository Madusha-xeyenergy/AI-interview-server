import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const expected = Buffer.from(env.AGENT_SECRET);

/** For server-to-server calls from the voice agent, which has no login cookie. */
const requireAgentSecret = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.get("x-agent-secret") ?? "";
  const received = Buffer.from(header);

  // timingSafeEqual: the response time doesn't reveal how many characters matched.
  // It throws on different lengths, so check that first.
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new HttpError(401, "Invalid agent secret");
  }

  next();
};

export { requireAgentSecret };
