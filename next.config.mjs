// /** @type {import('next').NextConfig} */
// const nextConfig = {};

// export default nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverComponentsExternalPackages: ['puppeteer'],
      largePageDataBytes: 128 * 1000 * 1000, // 128MB (default is 128KB)
    },
  };
  
  export default nextConfig;