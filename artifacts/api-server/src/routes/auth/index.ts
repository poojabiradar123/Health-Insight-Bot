import { Router, type IRouter, type Request, type Response } from "express";

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
  }
}

const router: IRouter = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "clinical123";

router.post("/auth/login", (req: Request, res: Response): void => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.userId = username;
  req.session.username = username;

  res.json({ username, displayName: "Clinical Analyst" });
});

router.post("/auth/logout", (req: Request, res: Response): void => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get("/auth/me", (req: Request, res: Response): void => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ username: req.session.username, displayName: "Clinical Analyst" });
});

export default router;
