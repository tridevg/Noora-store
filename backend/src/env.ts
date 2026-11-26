export type Env = { DB: D1Database; IMAGES: R2Bucket; SESSION_SECRET: string };

export type AppEnv = { Bindings: Env };
