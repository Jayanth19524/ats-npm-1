import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import type { Request, Response } from "express";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

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
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser(SESSION_SECRET));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (process.env.SERVE_PUBLIC_UPLOADS === "true") {
  app.use(
    "/uploads",
    express.static(path.resolve(process.cwd(), "uploads"), {
      maxAge: "30d",
      fallthrough: false,
    }),
  );
}

function frontendBaseUrl(req: Request): string {
  const configured = process.env.FRONTEND_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5173";
  }

  const proto = req.header("x-forwarded-proto") ?? req.protocol;
  const host = req.header("x-forwarded-host") ?? req.get("host");
  if (!host) throw new Error("Could not determine frontend URL");
  return `${proto}://${host}`;
}

function redirectToFrontend(req: Request, res: Response, pathName: string): void {
  const url = new URL(pathName, `${frontendBaseUrl(req)}/`);
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (token) url.searchParams.set("token", token);
  res.redirect(302, url.toString());
}

app.get("/reset-password", (req, res) => {
  redirectToFrontend(req, res, "/reset-password");
});

app.get("/careers/reset-password", (req, res) => {
  redirectToFrontend(req, res, "/careers/reset-password");
});

app.use("/api", router);

if (process.env.SERVE_FRONTEND === "true") {
  const frontendDist = path.resolve(process.cwd(), "../frontend/dist");
  app.use(express.static(frontendDist, { maxAge: "1d" }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
