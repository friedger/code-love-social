/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;
  readonly VITE_NOSTR_RELAY?: string;
  readonly VITE_MATRIX_HOMESERVER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
