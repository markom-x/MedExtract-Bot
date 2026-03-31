import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Forza la root del progetto Next al CWD del comando (`web-app`).
    // Evita che Turbopack risolva moduli dalla cartella padre.
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
