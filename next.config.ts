import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.3.9"],
};

const withNextIntl = createNextIntlPlugin();

export default withSerwist(withNextIntl(nextConfig));
