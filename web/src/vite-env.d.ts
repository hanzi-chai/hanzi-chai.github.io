/// <reference types="vite/client" />
/// <reference types="vite-plugin-pages/client-react" />

declare const APP_VERSION: string;

interface ImportMetaEnv {
  readonly APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
