import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Controller } from "./controller.js";
import { Discovery, localSubnets } from "./discovery.js";
import { TvError, validateHost, validatePath } from "./jointspace.js";

export function createApp(controller) {
  const app = express();
  const discovery = new Discovery((tv) => controller.add(tv));
  app.disable("x-powered-by");
  app.use("/api", (request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.origin;
      if (
        request.headers["sec-fetch-site"] === "cross-site" ||
        (origin && origin !== `${request.protocol}://${request.get("host")}`)
      )
        return response
          .status(403)
          .json({ error: "Cross-origin control requests are blocked." });
    }
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  app.get("/api/health", (_, response) => response.json({ ok: true }));
  app.get("/api/devices", (_, response) =>
    response.json({
      devices: controller.list(),
      discovery: discovery.state,
      subnets: localSubnets(),
    }),
  );
  app.post("/api/discovery", (request, response) => {
    response.json(
      discovery.start(
        request.body?.subnet,
        [...controller.devices.values()]
          .filter((tv) => !tv.demo)
          .map((tv) => tv.host),
      ),
    );
  });
  app.post("/api/devices", async (request, response) =>
    response.json(await controller.addHost(validateHost(request.body?.host))),
  );
  app.post("/api/demo", (_, response) => response.json(controller.addDemo()));
  app.delete("/api/devices/:id", async (request, response) => {
    await controller.forget(request.params.id);
    response.json({ ok: true });
  });
  app.post("/api/devices/:id/pair/request", async (request, response) =>
    response.json(await controller.startPairing(request.params.id)),
  );
  app.post("/api/devices/:id/pair/grant", async (request, response) =>
    response.json(
      await controller.finishPairing(request.params.id, request.body?.pin),
    ),
  );
  app.get("/api/devices/:id/status", async (request, response) =>
    response.json(await controller.status(request.params.id)),
  );
  app.get("/api/devices/:id/catalog", async (request, response) =>
    response.json(
      await controller.catalog(
        request.params.id,
        request.query.refresh === "true",
      ),
    ),
  );
  app.post("/api/devices/:id/command", async (request, response) =>
    response.json(await controller.command(request.params.id, request.body)),
  );
  app.post("/api/devices/:id/api", async (request, response) => {
    const { method, endpoint, body } = request.body || {};
    if (!["GET", "POST"].includes(method))
      throw new TvError("Only GET and POST are supported.", 400);
    const tv = controller.get(request.params.id);
    response.json(
      await controller.call(
        tv,
        validatePath(endpoint),
        method,
        method === "POST" ? body : undefined,
      ),
    );
  });
  app.use("/api", (_, response) =>
    response.status(404).json({ error: "API route not found." }),
  );
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "dist",
  );
  app.use(express.static(root));
  app.get("/{*path}", (_, response) =>
    response.sendFile(path.join(root, "index.html")),
  );
  app.use((error, _, response, next) => {
    if (response.headersSent) return next(error);
    const status =
      error instanceof TvError
        ? error.status
        : error.type === "entity.parse.failed"
          ? 400
          : error.status === 413
            ? 413
            : 500;
    if (status === 500) console.error(error.message);
    response
      .status(status)
      .json({
        error:
          status === 500
            ? "Internal server error. Check server logs."
            : status === 400 && !(error instanceof TvError)
              ? "Invalid JSON body."
              : error.message,
        code: error.code || "ERROR",
      });
  });
  return { app, discovery };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const controller = new Controller(
    process.env.DATA_DIR || path.resolve("data"),
  );
  await controller.load();
  const { app } = createApp(controller);
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, process.env.HOST || "0.0.0.0", () =>
    console.log(`Philips Remote: http://localhost:${port}`),
  );
}
