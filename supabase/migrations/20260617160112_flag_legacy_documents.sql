-- Flag pre-Fix-F documents that have no application scope
-- These are ungrouped legacy rows and should be surfaced
-- as such in the dashboard rather than mixed with new data

ALTER TABLE generated_documents
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT false;

UPDATE generated_documents
SET is_legacy = true
WHERE jd_id IS NULL
  AND resume_id IS NULL
  AND created_at < NOW();

COMMENT ON COLUMN generated_documents.is_legacy IS
'True for documents generated before jd_id/resume_id were wired.
 These cannot be reliably grouped by application.';
