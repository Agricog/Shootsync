/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
  readonly VITE_APP_URL: string
  /** Optional: browser error reports go to Sentry when set. */
  readonly VITE_SENTRY_DSN?: string
  /** The deploy's commit, set at build time (vite.config.ts). */
  readonly VITE_RELEASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
