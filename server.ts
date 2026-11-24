import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import {
  mountBaseSecurityMiddleware,
  mountApiRoutes,
  mountErrorHandler
} from "./server/createApiApp";

dotenv.config();

// Process-level safety safeguards to prevent crashes on network hiccups or unhandled promise failures
process.on("uncaughtException", (error: any) => {
  console.error("[Fail-Safe] Uncaught Exception caught safely:", error);
  if (error && error.code === "EADDRINUSE") {
    console.error(
      `[Server Fatal] Port ${error.port || 3000} is already in use. Exiting to allow clean restart...`
    );
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fail-Safe] Unhandled Rejection caught safely at:", promise, "reason:", reason);
});

const resolveDistDir = (): string => {
  const candidates = [
    path.join(process.cwd(), "dist"),
    ...(typeof __dirname !== "undefined"
      ? [path.resolve(__dirname), path.resolve(__dirname, "../dist")]
      : [])
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, "index.html"))) {
        return dir;
      }
    } catch {
      // try next
    }
  }
  return path.join(process.cwd(), "dist");
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  mountBaseSecurityMiddleware(app);
  mountApiRoutes(app, { serverless: false });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = resolveDistDir();
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      const indexFile = path.join(distPath, "index.html");
      if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile);
      }
      return res.status(404).send("Production bundle not found. Run npm run build first.");
    });
  }

  mountErrorHandler(app);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err: any) => {
    console.error("[Server Error]:", err);
    if (err && err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is in use. Exiting process for clean restart...`);
      process.exit(1);
    }
  });
}

startServer();
