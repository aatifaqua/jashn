/**
 * Response headers for the API and for the hosted web app, plus the CORS allow-list. Every
 * policy is spelled out rather than left to library defaults, so a dependency update cannot
 * silently weaken it.
 */
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

/** Two years, the preload-list minimum, with subdomains. */
const HSTS = 'max-age=63072000; includeSubDomains';

/** Sensors, payment and capture are never needed, so every feature below is denied. */
const PERMISSIONS = {
  accelerometer: false,
  camera: false,
  geolocation: false,
  gyroscope: false,
  magnetometer: false,
  microphone: false,
  payment: false,
  usb: false,
};

/**
 * The web app's policy: everything from its own origin, no inline script or style, no eval,
 * no plugins, no framing. Exported so the static host and its tests share one definition.
 */
export const SPA_CSP = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  manifestSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

function headers(csp: Record<string, string[]>): MiddlewareHandler {
  return secureHeaders({
    contentSecurityPolicy: csp,
    strictTransportSecurity: HSTS,
    xContentTypeOptions: true,
    xFrameOptions: 'DENY',
    referrerPolicy: 'no-referrer',
    crossOriginResourcePolicy: 'same-origin',
    crossOriginOpenerPolicy: 'same-origin',
    permissionsPolicy: PERMISSIONS,
  });
}

/**
 * Headers for JSON API responses. `default-src 'none'` means a response opened directly in a
 * browser can load and run nothing, which neutralises any content it echoes.
 */
export function apiHeaders(): MiddlewareHandler {
  return headers({ defaultSrc: ["'none'"], frameAncestors: ["'none'"] });
}

/** Headers for the hosted web app: the SPA policy sent as a header, with framing denied. */
export function spaHeaders(): MiddlewareHandler {
  return headers(SPA_CSP);
}

/**
 * CORS for a browser app on another origin (the static demo host). Only listed origins get
 * CORS headers, and only POST is allowed, because the generative routes are the only ones a
 * page needs; unlisted origins receive no Access-Control headers at all.
 */
export function corsAllowList(origins: readonly string[]): MiddlewareHandler {
  return cors({
    origin: [...origins],
    allowMethods: ['POST'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  });
}
