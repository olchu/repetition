import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` blocks its scripts for any host but localhost; this lets other
  // computers on the home network open the app by this machine's IP.
  allowedDevOrigins: ["192.168.50.27"],
};

export default nextConfig;
