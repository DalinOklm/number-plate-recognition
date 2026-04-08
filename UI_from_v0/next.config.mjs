/** @type {import('next').NextConfig} */
const allowedDevOrigins = (
  process.env.NEXT_ALLOWED_DEV_ORIGINS ??
  "172.16.0.2"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins,
}

export default nextConfig
