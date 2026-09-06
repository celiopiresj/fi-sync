import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.3.9"],
  experimental: {
    serverActions: {
      // The fatura/extrato import uploads the file through a Server
      // Action, and Next.js caps an action body at 1 MB by default — a
      // phone photo of a statement is routinely several times that.
      // Kept in step with MAX_IMPORT_FILE_BYTES (src/lib/statement-import/
      // schema.ts), which is what actually rejects an oversized file,
      // with a little headroom for the multipart envelope.
      bodySizeLimit: "10mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withSerwist(withNextIntl(nextConfig));
