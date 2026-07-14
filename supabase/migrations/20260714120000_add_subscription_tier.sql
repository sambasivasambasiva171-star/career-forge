-- Freemium quota enforcement: track subscription tier per user.
-- Free tier is enforced in application code against generated_documents
-- counts; this column is the source of truth for which limit applies.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_tier_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT subscription_tier_check
    CHECK (subscription_tier IN ('free', 'premium', 'enterprise'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
ON public.profiles(subscription_tier);
