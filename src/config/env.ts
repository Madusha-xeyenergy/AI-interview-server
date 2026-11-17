import "dotenv/config";
import { z } from "zod";

// Validates environment variables once at startup, so a missing or
// malformed value fails fast instead of breaking a request later.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    JWT_EXPIRES_IN_HOURS: z.coerce.number().int().positive().default(24),
    GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
    // An empty value (GROQ_MODEL=) counts as unset, so the default still applies.
    GROQ_MODEL: z.preprocess((value) => value || undefined, z.string().default("openai/gpt-oss-120b")),
    // Question generation uses OpenAI; evaluation still uses Groq.
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    OPENAI_MODEL: z.preprocess((value) => value || undefined, z.string().default("gpt-4.1-mini")),
    // Frontend base URL, used to build candidate invite links.
    APP_URL: z.preprocess((value) => value || undefined, z.url().default("http://localhost:3000")),
    // Same LiveKit project as interview-agent/.env.local
    LIVEKIT_URL: z.string().regex(/^wss?:\/\//, "LIVEKIT_URL must start with ws:// or wss://"),
    LIVEKIT_API_KEY: z.string().min(1, "LIVEKIT_API_KEY is required"),
    LIVEKIT_API_SECRET: z.string().min(1, "LIVEKIT_API_SECRET is required"),
    // Must match agentName in interview-agent/src/agent.ts
    LIVEKIT_AGENT_NAME: z.preprocess((value) => value || undefined, z.string().default("interviewer")),
    // Shared with the voice agent: it sends this in the x-agent-secret header when posting transcripts.
    AGENT_SECRET: z.string().min(32, "AGENT_SECRET must be at least 32 characters"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
