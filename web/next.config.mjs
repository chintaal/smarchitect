/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Flow's node measurement (ResizeObserver) races with StrictMode's
  // double-invoked effects in dev, leaving nodes unmeasured. Disable it so the
  // canvas measures correctly; production already behaves like this.
  reactStrictMode: false,
  eslint: {
    // The product surface is large; lint is run separately, don't block builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
