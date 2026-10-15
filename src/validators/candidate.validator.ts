import { z } from "zod";

// Body of the multipart apply form. Every multipart field arrives as a string,
// so numbers and lists are converted here. The CV file itself is in req.file, not the body.
const applyCandidateSchema = z.object({
  jobId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid job id"),
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.email("Invalid email").trim().toLowerCase(),
  phone: z.string().trim().min(10, "Invalid phone number").max(20),
  location: z.string().trim().min(2, "Location is required").max(100),
  experience: z.coerce.number().min(0, "Experience can't be negative").max(60),
  // "React, Node.js, MongoDB" → ["React", "Node.js", "MongoDB"]
  skills: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
    ),
});

// GET /api/candidates/:id. A malformed id would make Mongoose throw a CastError (500); this makes it a 422.
const candidateIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid candidate id"),
});

export type ApplyCandidateInput = z.infer<typeof applyCandidateSchema>;
export { applyCandidateSchema, candidateIdParamSchema };
