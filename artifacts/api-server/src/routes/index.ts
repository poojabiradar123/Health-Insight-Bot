import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import analysisRouter from "./analysis/index.js";
import authRouter from "./auth/index.js";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

router.use(authRouter);
router.use(healthRouter);
router.use(requireAuth, analysisRouter);

export default router;
