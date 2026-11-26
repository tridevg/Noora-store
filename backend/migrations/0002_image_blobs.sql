-- Phase 7: image bytes move from R2 into D1. One row per stored object (full or thumb).
-- Keys are UUID-based and never overwritten; a row is written in the same D1 batch as the
-- product_images link that references it, and removed in the same batch as that link.
CREATE TABLE product_image_blobs (
  key TEXT PRIMARY KEY,                                -- e.g. products/12/<uuid>-full.webp
  content_type TEXT NOT NULL,                          -- image/webp or image/jpeg, as uploaded
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Noora brand defaults. Upserts, so a re-seed or a fresh database ends up with the same copy.
INSERT INTO settings (key, value) VALUES ('business_name', 'Noora')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO settings (key, value) VALUES ('banner_text', 'Noora — beauty parlour & ladies'' fashion')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
