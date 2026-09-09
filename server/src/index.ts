import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { HealthResponseSchema } from "@thinking-explorer/shared";
import { config, VERSION } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { sessionsRouter } from "./routes/sessions.js";
import { conceptsRouter } from "./routes/concepts.js";
import { relationshipsRouter } from "./routes/relationships.js";
import { expandRouter } from "./routes/expand.js";
import { connectRouter } from "./routes/connect.js";
import { challengeRouter } from "./routes/challenge.js";
import { compareRouter } from "./routes/compare.js";
import { trailRouter } from "./routes/trail.js";
import { searchRouter } from "./routes/search.js";
import { exportRouter } from "./routes/export.js";
import { HttpError } from "./validation/validate.js";

runMigrations();

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req: Request, res: Response) => {
  const body = HealthResponseSchema.parse({
    ok: true,
    version: VERSION,
    llmConfigured: config.openrouter.apiKey.length > 0,
  });
  res.json(body);
});

app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions/:id/concepts", conceptsRouter);
app.use("/api/sessions/:id/relationships", relationshipsRouter);
app.use("/api/sessions/:id/expand", expandRouter);
app.use("/api/sessions/:id/connect", connectRouter);
app.use("/api/sessions/:id/challenge", challengeRouter);
app.use("/api/sessions/:id/compare", compareRouter);
app.use("/api/sessions/:id/trail", trailRouter);
app.use("/api/sessions/:id/search", searchRouter);
app.use("/api/sessions/:id/export", exportRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({
    error: { code: "internal_error", message },
  });
});

app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
});