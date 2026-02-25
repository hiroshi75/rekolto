import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { logger } from "../utils/logger.js";

const PAGEINDEX_PORT = 8765;
const PAGEINDEX_BASE_URL = `http://127.0.0.1:${PAGEINDEX_PORT}`;

let serviceProcess: ChildProcess | null = null;

/**
 * Spawn the Python PageIndex HTTP server as a subprocess.
 * Uses `uv run python pageindex_service.py` from the python/ directory.
 */
export function startPageIndexService(): ChildProcess {
  if (serviceProcess && !serviceProcess.killed) {
    logger.info("PageIndex service already running");
    return serviceProcess;
  }

  const pythonDir = resolve(process.cwd(), "python");

  logger.info({ cwd: pythonDir }, "Starting PageIndex Python service");

  serviceProcess = spawn("uv", ["run", "python", "pageindex_service.py"], {
    cwd: pythonDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PAGEINDEX_PORT: String(PAGEINDEX_PORT),
    },
  });

  serviceProcess.stdout?.on("data", (data: Buffer) => {
    logger.debug({ source: "pageindex-stdout" }, data.toString().trim());
  });

  serviceProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    // Flask startup messages go to stderr; only log errors
    if (msg.includes("Error") || msg.includes("Traceback")) {
      logger.error({ source: "pageindex-stderr" }, msg);
    } else {
      logger.debug({ source: "pageindex-stderr" }, msg);
    }
  });

  serviceProcess.on("exit", (code, signal) => {
    logger.info({ code, signal }, "PageIndex service exited");
    serviceProcess = null;
  });

  serviceProcess.on("error", (err) => {
    logger.error({ err }, "Failed to start PageIndex service");
    serviceProcess = null;
  });

  return serviceProcess;
}

/**
 * Stop the PageIndex service if running.
 */
export function stopPageIndexService(): void {
  if (serviceProcess && !serviceProcess.killed) {
    serviceProcess.kill("SIGTERM");
    serviceProcess = null;
    logger.info("PageIndex service stopped");
  }
}

/**
 * Check if the PageIndex service is available.
 */
async function isServiceAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${PAGEINDEX_BASE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for the PageIndex service to become available (up to maxWaitMs).
 */
async function waitForService(maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isServiceAvailable()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Ensure the PageIndex service is running and available.
 * Starts it if needed and waits for it to be ready.
 */
async function ensureService(): Promise<boolean> {
  if (await isServiceAvailable()) {
    return true;
  }

  // Try to start the service
  startPageIndexService();
  const ready = await waitForService();

  if (!ready) {
    logger.warn("PageIndex service failed to start within timeout");
  }

  return ready;
}

/**
 * Index a document, producing a PageIndex tree.
 * POST to localhost:8765/index with {content, title}.
 */
export async function indexDocument(
  content: string,
  title: string
): Promise<object> {
  const available = await ensureService();
  if (!available) {
    throw new Error("PageIndex service is not available");
  }

  const response = await fetch(`${PAGEINDEX_BASE_URL}/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, title }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PageIndex /index failed (${response.status}): ${text}`);
  }

  return (await response.json()) as object;
}

/**
 * Search within a PageIndex tree for sections matching a query.
 * POST to localhost:8765/search with {tree_json, query}.
 */
export async function searchDocument(
  treeJson: object,
  query: string
): Promise<{
  sections: { title: string; content: string; path: string }[];
}> {
  const available = await ensureService();
  if (!available) {
    throw new Error("PageIndex service is not available");
  }

  const response = await fetch(`${PAGEINDEX_BASE_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tree_json: JSON.stringify(treeJson),
      query,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PageIndex /search failed (${response.status}): ${text}`);
  }

  const result = (await response.json()) as {
    sections: { title: string; content: string; path: string; relevance?: number }[];
  };

  return {
    sections: result.sections.map((s) => ({
      title: s.title,
      content: s.content,
      path: s.path,
    })),
  };
}
