import { Hono } from 'hono';

const app = new Hono();

// Health stub. Phase 3 adds the public /api routes; Phase 4 adds /api/admin/*.
app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
