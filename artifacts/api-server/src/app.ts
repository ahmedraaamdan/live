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

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found", code: "not_found" });
});

// Production: the same server hands out the built app (one origin, no CORS).
if (env.appDist && existsSync(env.appDist)) {
  app.use(express.static(env.appDist, { index: false, maxAge: "1h" }));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(env.appDist, "index.html"));
  });
}

app.use(errorHandler);

export default app;
