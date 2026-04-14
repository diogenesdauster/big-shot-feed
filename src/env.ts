import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  ADMIN_API_KEY: z.string().min(16, "ADMIN_API_KEY must be at least 16 chars"),
  GITHUB_TOKEN: z.string().optional(),
  CRON_SCHEDULE: z.string().default("0 * * * *"),
  DRY_RUN: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
