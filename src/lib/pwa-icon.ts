import { readFileSync } from "node:fs";
import { join } from "node:path";

export function getLogoIconDataUri() {
  const logo = readFileSync(join(process.cwd(), "public", "logo-icon.png"));
  return `data:image/png;base64,${logo.toString("base64")}`;
}
