/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@copilotkit"],
  webpack: (config) => {
    // Suppress critical dependency warning from @whatwg-node/fetch
    // This is a known issue with graphql-yoga and copilotkit runtime
    config.module.exprContextCritical = false;

    return config;
  },

  // Ignore specific warnings in development
  onDemandEntries: {
    // Ensure entries are disposed properly to avoid HMR issues
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig;