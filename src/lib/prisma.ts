import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon's serverless driver talks over WebSockets/HTTP instead of raw TCP.
// Node.js has no built-in WebSocket client, so it needs the `ws` package.
neonConfig.webSocketConstructor = ws;

// DATABASE_URL should be the **pooled** Neon connection string (hostname
// with `-pooler`). See `.env.example` and tasks/001-data-model.md.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse a single client across hot reloads in dev instead of creating a new
// connection pool on every module reload.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
