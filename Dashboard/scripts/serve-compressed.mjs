import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createBrotliCompress, createGzip, constants } from "node:zlib";

const DIST_DIR = path.resolve(process.cwd(), "out");
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const COMPRESSIBLE_EXTS = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".webmanifest",
  ".svg",
  ".txt",
  ".xml",
]);

function pickEncoding(acceptEncoding) {
  if (!acceptEncoding) return null;

  if (/\bbr\b/i.test(acceptEncoding)) return "br";
  if (/\bgzip\b/i.test(acceptEncoding)) return "gzip";

  return null;
}

async function resolveStaticFile(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const normalized = path.posix.normalize(cleanPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const relative = normalized.startsWith("/") ? normalized.slice(1) : normalized;

  const candidates = [];

  if (!relative || relative.endsWith("/")) {
    candidates.push(path.join(DIST_DIR, relative, "index.html"));
  } else {
    candidates.push(path.join(DIST_DIR, relative));
    candidates.push(path.join(DIST_DIR, `${relative}.html`));
    candidates.push(path.join(DIST_DIR, relative, "index.html"));
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith(DIST_DIR)) continue;

    const info = await stat(candidate).catch(() => null);

    if (info?.isFile()) {
      return { filePath: candidate, size: info.size, statusCode: 200 };
    }
  }

  const notFoundPath = path.join(DIST_DIR, "404.html");
  const notFoundInfo = await stat(notFoundPath).catch(() => null);

  if (notFoundInfo?.isFile()) {
    return { filePath: notFoundPath, size: notFoundInfo.size, statusCode: 404 };
  }

  return null;
}

function resolveCacheControl(relPath, ext) {
  if (relPath.startsWith("_next/static/")) {
    return "public, max-age=31536000, immutable";
  }

  if (ext === ".html" || relPath === "sw.js") {
    return "public, max-age=0, must-revalidate";
  }

  return "public, max-age=3600, stale-while-revalidate=86400";
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");

    return;
  }

  const resolved = await resolveStaticFile(req.url || "/");

  if (!resolved) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");

    return;
  }

  const { filePath, size, statusCode } = resolved;
  const relPath = path.relative(DIST_DIR, filePath).split(path.sep).join("/");
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const cacheControl = resolveCacheControl(relPath, ext);
  const canCompress = COMPRESSIBLE_EXTS.has(ext);
  const encoding = canCompress ? pickEncoding(req.headers["accept-encoding"]) : null;

  const baseHeaders = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  };

  if (canCompress) {
    baseHeaders.Vary = "Accept-Encoding";
  }

  if (encoding === "br" || encoding === "gzip") {
    const sidecarPath = `${filePath}.${encoding === "br" ? "br" : "gz"}`;
    const sidecarInfo = await stat(sidecarPath).catch(() => null);

    if (sidecarInfo?.isFile()) {
      res.writeHead(statusCode, {
        ...baseHeaders,
        "Content-Encoding": encoding,
        "Content-Length": String(sidecarInfo.size),
      });

      if (req.method === "HEAD") {
        res.end();

        return;
      }

      createReadStream(sidecarPath).pipe(res);

      return;
    }

    if (size >= 512) {
      res.writeHead(statusCode, {
        ...baseHeaders,
        "Content-Encoding": encoding,
      });

      if (req.method === "HEAD") {
        res.end();

        return;
      }

      const compressor =
        encoding === "br"
          ? createBrotliCompress({
              params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
            })
          : createGzip({ level: 6 });

      createReadStream(filePath).pipe(compressor).pipe(res);

      return;
    }
  }

  res.writeHead(statusCode, {
    ...baseHeaders,
    "Content-Length": String(size),
  });

  if (req.method === "HEAD") {
    res.end();

    return;
  }

  createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[serve-compressed] Serving ${DIST_DIR} on http://${HOST}:${PORT} (Brotli + Gzip)`);
});
