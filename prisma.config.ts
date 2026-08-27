import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // The CLI (migrate, studio, db pull...) needs the *direct* (non-pooled)
  // Neon connection string, not the pooled one used by Prisma Client at
  // runtime. See .env.example.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
