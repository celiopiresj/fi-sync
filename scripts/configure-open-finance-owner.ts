import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";

// Local setup only. Resolve the explicitly supplied email against Neon
// Auth; never choose the first user or persist an email in public.User.
async function main() {
  const email = z.email().parse(process.argv[2]);
  const users = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "neon_auth"."user" WHERE lower("email") = lower(${email})
  `;
  if (users.length !== 1 || !/^[a-zA-Z0-9_-]+$/.test(users[0].id)) {
    throw new Error("Não foi possível identificar uma única conta no Neon Auth.");
  }
  const user = await prisma.user.findUnique({ where: { id: users[0].id }, select: { id: true } });
  if (!user) throw new Error("Entre no fi-sync antes de configurar o Open Finance.");
  const path = resolve(".env");
  const content = readFileSync(path, "utf8");
  const setting = `OPEN_FINANCE_USER_ID="${user.id}"`;
  const next = /^OPEN_FINANCE_USER_ID=.*$/m.test(content)
    ? content.replace(/^OPEN_FINANCE_USER_ID=.*$/m, setting)
    : `${content.trimEnd()}\n\n${setting}\n`;
  writeFileSync(path, next, "utf8");
  console.log("Acesso exclusivo configurado em .env. Reinicie o servidor para carregar a configuração.");
  console.log(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET
    ? "Credenciais da Pluggy encontradas no ambiente."
    : "Ainda é necessário configurar PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no servidor.");
}

void main().catch(() => {
  console.error("Não foi possível configurar o proprietário do Open Finance. Confira o e-mail, a conta e o acesso ao banco.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
