import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import jobsRouter from "./jobs";
import jobQuestionsRouter from "./job-questions";
import stagesRouter from "./stages";
import candidatesRouter from "./candidates";
import tasksRouter from "./tasks";
import referralsRouter from "./referrals";
import templatesRouter from "./templates";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import authRouter from "./auth";
import publicRouter from "./public";
import uploadsRouter from "./uploads";
import { requireStaff } from "../lib/viewer";
import { readSession } from "../lib/session";
import type { Request, Response, NextFunction } from "express";

function requireAnySession(req: Request, res: Response, next: NextFunction): void {
  const s = readSession(req);
  if (s) return next();
  if (req.header("x-viewer-id")) return next();
  res.status(401).json({ error: "Sign in required" });
}

function requireCookieSession(req: Request, res: Response, next: NextFunction): void {
  const s = readSession(req);
  if (s) return next();
  res.status(401).json({ error: "Sign in required" });
}

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(publicRouter);
router.use(requireCookieSession, uploadsRouter);
router.use(requireStaff, profilesRouter);
router.use(requireStaff, jobsRouter);
router.use(requireStaff, jobQuestionsRouter);
router.use(requireStaff, stagesRouter);
router.use(requireStaff, candidatesRouter);
router.use(requireStaff, tasksRouter);
router.use(requireStaff, referralsRouter);
router.use(requireStaff, templatesRouter);
router.use(requireStaff, dashboardRouter);
router.use(requireStaff, reportsRouter);

export default router;
