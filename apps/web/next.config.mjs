/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    //const isDev = process.env.NODE_ENV !== "production";
    const destination = 'https://fbauthstart-av6mtu24ja-uc.a.run.app'
    return [
      {
        source: "/fbAuthStart",
        destination,
      },
    ];
  },
};

export default nextConfig;
