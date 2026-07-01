// Loads and validates environment variables once at startup.
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:3000"),
  // Public URL of THIS server, used to build the Billplz callback URL.
  // On Render set this to the service URL; must be reachable from the internet.
  SERVER_PUBLIC_URL: z.string().url().default("http://localhost:4000"),

  // Billplz — allowed to be empty in dev so the server still boots; the shop
  // route checks for real values before creating a bill.
  BILLPLZ_BASE_URL: z.string().default("https://www.billplz-sandbox.com/api"),
  BILLPLZ_API_KEY: z.string().default(""),
  BILLPLZ_XSIGNATURE_KEY: z.string().default(""),
  BILLPLZ_COLLECTION_ID: z.string().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isBillplzConfigured = Boolean(
  env.BILLPLZ_API_KEY && env.BILLPLZ_XSIGNATURE_KEY && env.BILLPLZ_COLLECTION_ID
);
