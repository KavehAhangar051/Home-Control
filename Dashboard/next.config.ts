import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

function parseAllowedHosts(raw: string | undefined): string[] {
  if (!raw) return [];

  return raw
    .split(/[,\s]+/)
    .map((host) => host.trim())
    .filter(Boolean);
}

export default function buildNextConfig(phase: string): NextConfig {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    reactCompiler: !isDevServer
      ? {
          compilationMode: "infer",
          panicThreshold: "none",
        }
      : false,
    compiler: !isDevServer
      ? {
          removeConsole: {
            exclude: ["error", "warn"],
          },
        }
      : undefined,
    // Opt in only for profiling builds; normal static exports stay unchanged.
    productionBrowserSourceMaps: process.env.ENABLE_PROFILING_SOURCEMAPS === "true",
    allowedDevOrigins: [
      "localhost",
      "**.localhost",
      "127.0.0.1",
      "**.run.app",
      "**.googleusercontent.com",
      "**.google.com",
      ...parseAllowedHosts(process.env.NG_ALLOWED_HOSTS),
    ],
    turbopack: {
      resolveAlias: {
        fs: {
          browser: "./lib/empty-module.ts",
        },
        path: {
          browser: "./lib/empty-module.ts",
        },
      },
    },
    experimental: {
      useTypeScriptCli: true,
      inlineCss: !isDevServer,
      cssChunking: "graph",
      scrollRestoration: true,
      optimizeServerReact: true,
      turbopackGc: true,
      turbopackRemoveUnusedImports: true,
      turbopackRemoveUnusedExports: true,
      turbopackCrossModuleConstants: true,
      turbopackCjsTreeShaking: true,
      turbopackCjsScopeHoisting: true,
      turbopackChunking: {
        firstPageLoadPriority: 0.85,
        priorityRoutes: [/^\/$/],
      },
      optimizePackageImports: [
        "@animate-ui/react",
        "@base-ui/react",
        "@danfessler/trellis",
        "@danfessler/trellis-react",
        "@dnd-kit/dom",
        "@dnd-kit/react",
        "motion",
        "zustand",
      ],
    },
    typescript: {
      ignoreBuildErrors: false,
    },
    // Allow access to remote image placeholder.
    images: {
      unoptimized: true,
      remotePatterns: [
        {
          protocol: "https",
          hostname: "picsum.photos",
          port: "",
          pathname: "/**", // This allows any path under the hostname
        },
        {
          protocol: "https",
          hostname: "upload.wikimedia.org",
          port: "",
          pathname: "/**",
        },
        {
          protocol: "https",
          hostname: "images.unsplash.com",
          port: "",
          pathname: "/**",
        },
      ],
    },
    output: isDevServer || process.env.DISABLE_HMR === "true" ? undefined : "export",
    transpilePackages: ["motion"],
    webpack: (config, { dev, isServer }) => {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      if (dev && process.env.DISABLE_HMR === "true") {
        config.watchOptions = {
          ignored: /.*/,
        };
      }

      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
          path: false,
        };
      }

      return config;
    },
  };

  if (process.env.GITHUB_PAGES === "true") {
    nextConfig.basePath = "/Home-Control-Dashboard";
    nextConfig.assetPrefix = "/Home-Control-Dashboard/";
    nextConfig.trailingSlash = true;
  }

  return nextConfig;
}
