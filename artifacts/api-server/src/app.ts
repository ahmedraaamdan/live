import { retainAppAssets } from "./lib/asset-cache";
import express, { type Express } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { authenticate } from "./lib/auth";
import { env } from "./lib/env";
import { errorHandler } from "./lib/http";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: env.corsOrigins, maxAge: 86_400 }));
// Uploads and the LiveKit webhook read their own raw bodies.
app.use(express.json({ limit: "1mb", type: ["application/json"] }));
app.use(express.urlencoded({ extended: true }));
app.use(authenticate);

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found", code: "not_found" });
});

// Production: the same server hands out the built app (one origin, no CORS).
if (env.appDist && existsSync(env.appDist)) {
  const assets = path.join(env.appDist, "assets");
  const cache = path.join(env.uploadDir, ".app-assets");
  try { retainAppAssets(assets, cache); }
  catch (err) { logger.warn({ err }, "Could not retain versioned app assets"); }
  app.use("/assets", express.static(cache, { maxAge: "1y", immutable: true }));
  app.use("/assets", express.static(assets, { maxAge: "1y", immutable: true }));
  // A missing script is not an HTML app route.
  app.use("/assets", (_req, res) => { res.status(404).type("text/plain").send("Asset unavailable"); });
  app.use(express.static(env.appDist, { index: false, maxAge: "1h", setHeaders: (res, file) => {
    if (path.basename(file) === "index.html") res.setHeader("Cache-Control", "no-store");
  } }));
  app.get("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(env.appDist, "index.html"));
  });
}

app.use(errorHandler);

export default app;
