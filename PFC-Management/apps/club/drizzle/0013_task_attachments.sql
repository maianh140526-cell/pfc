-- Task file attachments (tài liệu đính kèm công việc). Files live in PFC App storage; Club keeps the link + metadata.
CREATE TABLE IF NOT EXISTS task_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL,
  uploader_id TEXT NOT NULL REFERENCES members(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON task_attachments(task_id, created_at);
