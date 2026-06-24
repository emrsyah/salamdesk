/** @type {import('next').NextConfig} */
const nextConfig = {
  // voyageai@0.2.1 ships a broken ESM build (extensionless `../Client` imports).
  // Keep it external so Next loads its CJS build at runtime instead of bundling it.
  // pino/pino-pretty use worker threads for transports; bundling them breaks
  // transport resolution. Keep them external so they load at runtime.
  serverExternalPackages: ["voyageai", "pino", "pino-pretty"],
}

export default nextConfig
