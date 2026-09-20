/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The certificate PDF is generated server-side, so no special image config is needed.
  // Keep the default build output; deploy target (Vercel / Node host) serves both
  // static pages and the /api serverless routes.
};

module.exports = nextConfig;
