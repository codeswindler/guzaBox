/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Add rewrites to proxy API calls to backend (if backend is on same server)
  // This only works for server-side requests, not client-side
  // For client-side, you need a reverse proxy (nginx) or set NEXT_PUBLIC_API_URL
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    // Only add rewrites if backend URL is localhost (same server)
    if (backendUrl.includes("localhost") || backendUrl.includes("127.0.0.1")) {
      return [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/:path*`,
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
