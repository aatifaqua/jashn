/** Security headers and CORS, spelled out so a dependency update cannot silently weaken them. */
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

// Two years, the preload-list minimum.
const HSTS = 'max-age=63072000; includeSubDomains';

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

// Own origin only: no inline script or style, no eval, no plugins, no framing.
const SPA_CSP = {
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

/** `default-src 'none'`: an API response opened in a browser can load and run nothing. */
export function apiHeaders(): MiddlewareHandler {
  return headers({ defaultSrc: ["'none'"], frameAncestors: ["'none'"] });
}

/** The SPA policy sent as a header for the hosted web app, with framing denied. */
export function spaHeaders(): MiddlewareHandler {
  return headers(SPA_CSP);
}

/** Only listed origins get CORS headers, and only for POST, all a cross-origin page needs. */
export function corsAllowList(origins: readonly string[]): MiddlewareHandler {
  return cors({
    origin: [...origins],
    allowMethods: ['POST'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  });
}
