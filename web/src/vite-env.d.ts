/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the Jashn API, or "/" when the server hosts the app on the same origin. Empty
   * (the default) switches the client to demo mode.
   */
  readonly VITE_API_BASE?: string;
}
