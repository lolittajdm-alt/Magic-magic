CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  digest TEXT NOT NULL,
  details TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  invoice_id TEXT UNIQUE,
  page_url TEXT,
  created_at INTEGER NOT NULL,
  checked_at INTEGER NOT NULL DEFAULT 0,
  bank_modified TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS orders_pending ON orders(status, checked_at);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  sent_at INTEGER,
  message_id INTEGER
);
CREATE INDEX IF NOT EXISTS notifications_due ON notifications(sent_at, next_at, lease_until);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires_at);
