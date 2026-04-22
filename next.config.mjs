/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: "export",
  basePath: "/git-trends.github.io",
  env: {
    NEXT_PUBLIC_BASE_PATH: "/git-trends.github.io",
  },
};

export default nextConfig;
