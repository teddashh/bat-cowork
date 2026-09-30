import {
  createWebSocketTransportFactory,
  defaultWebSocketFactory,
} from "../daemon-client-websocket-transport.js";
import type { DaemonTransportFactory, WebSocketFactory } from "../daemon-client-transport-types.js";

/**
 * Injected socket constructor for a native host (Tauri / Node `ws`).
 * `kind: "browser"` marks a factory that cannot attach an Authorization header.
 * `defaultWebSocketFactory` is treated as browser even without that flag:
 * it drops `headers` and would silently lose the credential.
 */
export type CoworkWebSocketFactory = WebSocketFactory & {
  readonly kind?: "browser" | "native";
};

export interface CreateNativeDaemonTransportOptions {
  webSocketFactory: CoworkWebSocketFactory;
  /**
   * Headers to place on the socket. DaemonClient also passes headers when it
   * calls the returned factory. Either site refuses Authorization on a browser
   * factory. This module is the only cowork module that reads these headers.
   */
  headers?: Record<string, string>;
}

export class BrowserAuthorizationError extends Error {
  constructor() {
    super(
      "Refusing to set Authorization on a browser WebSocket. defaultWebSocketFactory does not pass headers, so a browser client would drop the credential. Inject a native WebSocket factory instead.",
    );
    this.name = "BrowserAuthorizationError";
  }
}

function hasAuthorization(headers: Record<string, string> | undefined): boolean {
  if (!headers) return false;
  return Object.keys(headers).some((name) => name.toLowerCase() === "authorization");
}

function isBrowserFactory(factory: CoworkWebSocketFactory): boolean {
  return factory === defaultWebSocketFactory || factory.kind === "browser";
}

function assertAuthorizationAllowed(
  factory: CoworkWebSocketFactory,
  headers: Record<string, string> | undefined,
): void {
  if (hasAuthorization(headers) && isBrowserFactory(factory)) {
    throw new BrowserAuthorizationError();
  }
}

function mergeHeaders(
  base: Record<string, string> | undefined,
  override: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (base === undefined && override === undefined) return undefined;
  return { ...base, ...override };
}

/**
 * Builds the transport DaemonClient can take on `transportFactory`.
 * Public `PaseoClientConfig` does not accept that field.
 */
export function createNativeDaemonTransport(
  options: CreateNativeDaemonTransportOptions,
): DaemonTransportFactory {
  const { webSocketFactory } = options;
  assertAuthorizationAllowed(webSocketFactory, options.headers);
  return createWebSocketTransportFactory((url, socketOptions) => {
    const headers = mergeHeaders(options.headers, socketOptions?.headers);
    assertAuthorizationAllowed(webSocketFactory, headers);
    return webSocketFactory(url, {
      ...socketOptions,
      ...(headers !== undefined ? { headers } : {}),
    });
  });
}
