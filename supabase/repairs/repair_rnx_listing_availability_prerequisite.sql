-- RuffNeck Exchange repair: restore the availability columns required by migrations 019 and 020.
-- Safe to run more than once. Run this before re-running migrations 019 and 020.

ALTER TABLE public.rnx_listings
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'unconfirmed',
  ADD COLUMN IF NOT EXISTS availability_note text,
  ADD COLUMN IF NOT EXISTS availability_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rnx_listings_availability_status_check'
      AND conrelid = 'public.rnx_listings'::regclass
  ) THEN
    ALTER TABLE public.rnx_listings
      ADD CONSTRAINT rnx_listings_availability_status_check
      CHECK (availability_status IN ('unconfirmed', 'available', 'limited', 'on_request', 'out_of_stock'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rnx_listings_availability_note_length_check'
      AND conrelid = 'public.rnx_listings'::regclass
  ) THEN
    ALTER TABLE public.rnx_listings
      ADD CONSTRAINT rnx_listings_availability_note_length_check
      CHECK (availability_note IS NULL OR char_length(availability_note) <= 240);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS rnx_listings_public_availability_idx
  ON public.rnx_listings (availability_status, status, created_at DESC);

COMMENT ON COLUMN public.rnx_listings.availability_status IS
  'Supplier-reported listing availability. It is not independently verified by RNX.';
COMMENT ON COLUMN public.rnx_listings.availability_note IS
  'Optional supplier-provided availability clarification, maximum 240 characters.';
COMMENT ON COLUMN public.rnx_listings.availability_updated_at IS
  'Timestamp of the latest supplier availability update; NULL means the supplier has not updated it.';

-- Confirm the prerequisite is now present.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'rnx_listings'
  AND column_name IN ('availability_status', 'availability_note', 'availability_updated_at')
ORDER BY column_name;
