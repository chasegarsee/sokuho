/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const isDev = process.env.NODE_ENV !== "production";
    const destination = isDev
      ? "http://localhost:5001/sokuho/us-central1/fbAuthStart"
      : (process.env.NEXT_PUBLIC_FUNCTIONS_URL
          ? `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/fbAuthStart`
          : "http://localhost:5001/sokuho/us-central1/fbAuthStart");
    return [
      {
        source: "/fbAuthStart",
        destination,
      },
    ];
  },
};

export default nextConfig;
