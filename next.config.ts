import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image runs the standalone server (see Dockerfile).
  output: "standalone",
  reactStrictMode: true,
  // No AGENTS.md/CLAUDE.md written into the repo by `next dev`.
  agentRules: false,
  // Dev only: the dev server may be opened from a phone in the LAN.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  async headers() {
    return [
      // Internal routes (statistics beacons, cron) belong in no index.
      {
        source: "/next/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
