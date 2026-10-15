import { Router } from "express";

import { env } from "../../config/env.js";
import { isDbConnected } from "../../config/db.js";

export const healthRouter = Router();




healthRouter.get("/", (_req,res) => {
  const database = isDbConnected() ? "connected" : "disconnected";

  //503 lets monitoring tools see the API is up but usable. 
  res.status(database === "connected"  ? 200 : 503).json({
    status: "ok",
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    database,
  })
})