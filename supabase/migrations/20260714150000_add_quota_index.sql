-- Speeds up the monthly quota check in lib/utils/quota.ts, which counts
-- rows per (user_id, doc_type) filtered by created_at each time a resume
-- is generated. Without this index that query does a sequential scan as
-- generated_documents grows.

CREATE INDEX IF NOT EXISTS idx_generated_documents_quota
ON public.generated_documents(user_id, created_at, doc_type)
WHERE doc_type = 'resume';
