import type { NextConfig } from "next";

const localTurbopackConfig: Pick<NextConfig, "turbopack"> =
  process.env.VERCEL === "1"
    ? {}
    : {
        turbopack: {
          // Solo in locale: evita che Turbopack risolva moduli dalla cartella utente.
          root: process.cwd(),
        },
      };

const nextConfig: NextConfig = {
  ...localTurbopackConfig,
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
