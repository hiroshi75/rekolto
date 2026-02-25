import WebSocket from "ws";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";

/**
 * WebSocket relay client for communicating with the Chrome extension.
 * Sends fetch commands to the extension, which opens tabs and returns rendered HTML.
 */
export class BrowserRelayClient {
  private ws: WebSocket | null = null;
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
   * Connect to the WebSocket server (Chrome extension side).
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://localhost:${this.port}`;
      logger.info({ url }, "Connecting to browser relay");

      this.ws = new WebSocket(url);

      const connectTimeout = setTimeout(() => {
        if (this.ws) {
          this.ws.terminate();
          this.ws = null;
        }
        reject(new Error(`Browser relay connection timeout (port ${this.port})`));
      }, 5000);

      this.ws.on("open", () => {
        clearTimeout(connectTimeout);
        logger.info({ port: this.port }, "Browser relay connected");
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
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

      this.ws.on("error", (err: Error) => {
        clearTimeout(connectTimeout);
        logger.error({ err }, "Browser relay WebSocket error");
        reject(err);
      });

      this.ws.on("close", () => {
        logger.info("Browser relay disconnected");
        this.ws = null;

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error("Browser relay connection closed"));
          this.pendingRequests.delete(id);
        }
      });
    });
  }

  /**
   * Check if the WebSocket connection is active.
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send a fetch command to the Chrome extension and wait for the response.
   */
  fetchPage(url: string): Promise<{ html: string; title?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("Browser relay not connected"));
        return;
      }

      const id = String(++this.requestIdCounter);
      const timeoutMs = 30000; // 30 seconds for page load

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Browser relay fetch timeout for ${url}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const command = JSON.stringify({ id, action: "fetch", url });
      this.ws!.send(command);

      logger.info({ id, url }, "Sent fetch command to browser relay");
    });
  }

  /**
   * Close the WebSocket connection.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// --- Singleton ---

let _relayClient: BrowserRelayClient | null = null;
let _initAttempted = false;

/**
 * Get the browser relay singleton.
 * Returns null if browser_relay is disabled in config or connection failed.
 */
export function getBrowserRelay(): BrowserRelayClient | null {
  const config = loadConfig();

  if (!config.browser_relay.enabled) {
    return null;
  }

  if (!_relayClient && !_initAttempted) {
    _initAttempted = true;
    _relayClient = new BrowserRelayClient(config.browser_relay.ws_port);

    // Attempt to connect in the background; don't block
    _relayClient.connect().catch((err) => {
      logger.warn({ err }, "Browser relay connection failed, will use HTTP fallback");
      _relayClient = null;
    });
  }

  if (_relayClient && !_relayClient.isConnected()) {
    return null;
  }

  return _relayClient;
}
