/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_SMARTSUITE_API_KEY: string
  readonly VITE_SMARTSUITE_WORKSPACE_ID: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
  readonly VITE_APP_URL: string
  readonly VITE_SENTRY_DSN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
