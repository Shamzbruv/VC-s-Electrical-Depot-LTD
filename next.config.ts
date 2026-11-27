import type {NextConfig} from 'next';

const nextConfig:NextConfig={
  output:'standalone',
  poweredByHeader:false,
  // Place preview metadata in the head for link services that do not run JavaScript.
  htmlLimitedBots:/.*/,
  async headers() {
    return [{
      source:'/:path*',
      has:[{type:'query',key:'websitePreview'}],
      headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}],
    }];
  },
};
export default nextConfig;
