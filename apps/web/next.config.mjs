/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // If NEXT_PUBLIC_FUNCTIONS_BASE is set, we don't need rewrites; client calls directly.
    // But for convenience in local dev, allow proxy paths to a provided base.
    const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE;
    if (!base) return [];
    return [
      { source: "/fbAuthStart", destination: `https://fbauthstart-av6mtu24ja-uc.a.run.app` },
      { source: "/igAuthStart", destination: `https://igauthstart-av6mtu24ja-uc.a.run.app` },
      { source: "/ttAuthStart", destination: `https://ttauthstart-av6mtu24ja-uc.a.run.app` },
      { source: "/fbPublish", destination: `${base}/fbPublish` },
      { source: "/igPublish", destination: `${base}/igPublish` },
    ];
  },
};

export default nextConfig;
