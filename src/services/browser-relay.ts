import { WebSocketServer, WebSocket } from "ws";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";

/**
 * WebSocket relay server that the Chrome extension connects to.
 * Rekolto sends fetch commands through this server to the extension,
 * which opens tabs and returns rendered HTML.
 *
 * Architecture:
 *   Rekolto (WS Server :9222) ← Chrome Extension (WS Client)
 */
export class BrowserRelayServer {
  private wss: WebSocketServer | null = null;
  private extensionSocket: WebSocket | null = null;
  private port: number;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: { html: string; title?: string }) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private requestIdCounter = 0;

  constructor(port: number) {
    this.port = port;
  }

  /**
   * Start the WebSocket server and wait for the Chrome extension to connect.
   */
  start(): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ port: this.port });

    logger.info({ port: this.port }, "Browser relay server listening");

    this.wss.on("connection", (ws) => {
      logger.info("Chrome extension connected to browser relay");

      // Only allow one extension connection at a time
      if (this.extensionSocket) {
        this.extensionSocket.close();
      }
      this.extensionSocket = ws;

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            id: string;
            html?: string;
            title?: string;
            error?: string;
          };

          const pending = this.pendingRequests.get(msg.id);
          if (!pending) {
            logger.warn({ id: msg.id }, "Received response for unknown request");
            return;
          }

          clearTimeout(pending.timer);
          this.pendingRequests.delete(msg.id);

          if (msg.error) {
            pending.reject(new Error(`Browser relay error: ${msg.error}`));
          } else if (msg.html) {
            pending.resolve({ html: msg.html, title: msg.title });
          } else {
            pending.reject(new Error("Browser relay returned empty response"));
          }
        } catch (err) {
          logger.error({ err }, "Failed to parse browser relay message");
        }
      });

      ws.on("close", () => {
        logger.info("Chrome extension disconnected from browser relay");
        if (this.extensionSocket === ws) {
          this.extensionSocket = null;
        }

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error("Chrome extension disconnected"));
          this.pendingRequests.delete(id);
        }
      });

      ws.on("error", (err) => {
        logger.error({ err }, "Browser relay extension socket error");
      });
    });

    this.wss.on("error", (err) => {
      logger.error({ err }, "Browser relay server error");
    });
  }

  /**
   * Check if the Chrome extension is connected.
   */
  isConnected(): boolean {
    return this.extensionSocket !== null && this.extensionSocket.readyState === WebSocket.OPEN;
  }

  /**
   * Send a fetch command to the Chrome extension and wait for the response.
   */
  fetchPage(url: string): Promise<{ html: string; title?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("Chrome extension not connected to browser relay"));
        return;
      }

      const id = String(++this.requestIdCounter);
      const timeoutMs = 30000;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Browser relay fetch timeout for ${url}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const command = JSON.stringify({ id, action: "fetch", url });
      this.extensionSocket!.send(command);

      logger.info({ id, url }, "Sent fetch command to Chrome extension");
    });
  }

  /**
   * Stop the WebSocket server.
   */
  stop(): void {
    if (this.extensionSocket) {
      this.extensionSocket.close();
      this.extensionSocket = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
      logger.info("Browser relay server stopped");
    }
  }
}

// --- Singleton ---

let _relayServer: BrowserRelayServer | null = null;

/**
 * Get the browser relay singleton.
 * Starts the WS server on first call if browser_relay is enabled in config.
 * Returns null if disabled or extension is not connected.
 */
export function getBrowserRelay(): BrowserRelayServer | null {
  const config = loadConfig();

  if (!config.browser_relay.enabled) {
    return null;
  }

  if (!_relayServer) {
    _relayServer = new BrowserRelayServer(config.browser_relay.ws_port);
    _relayServer.start();
  }

  if (!_relayServer.isConnected()) {
    return null;
  }

  return _relayServer;
}

/**
 * Start the browser relay server eagerly (call at app startup).
 * This allows the Chrome extension to connect before any URL is sent.
 */
export function startBrowserRelay(): void {
  const config = loadConfig();

  if (!config.browser_relay.enabled) {
    return;
  }

  if (!_relayServer) {
    _relayServer = new BrowserRelayServer(config.browser_relay.ws_port);
    _relayServer.start();
  }
}
