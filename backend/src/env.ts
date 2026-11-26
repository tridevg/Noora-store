export type Env = {
  DB: D1Database;
  IMAGES: R2Bucket;
  SESSION_SECRET: string;
  /** Optional public origin (e.g. https://<project>.pages.dev) for sitemap URLs behind the Pages proxy. */
  SITE_URL?: string;
};

export type AppEnv = { Bindings: Env };
