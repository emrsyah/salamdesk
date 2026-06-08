/** @type {import('next').NextConfig} */
const nextConfig = {
  // voyageai@0.2.1 ships a broken ESM build (extensionless `../Client` imports).
  // Keep it external so Next loads its CJS build at runtime instead of bundling it.
  serverExternalPackages: ["voyageai"],
}

export default nextConfig
