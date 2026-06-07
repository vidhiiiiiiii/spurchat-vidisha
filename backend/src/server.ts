import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/chat", chatRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Catches malformed JSON bodies and any error that slips past route handlers,
// so the process never crashes on a bad request — always respond with JSON.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("[unhandled error]", err);
  res.status(500).json({ error: "Something went wrong on our end. Please try again." });
};
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Spur chat backend listening on http://localhost:${port}`);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
