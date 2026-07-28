-- Early Bird / promo codes on quotes (pipeline slot tracking)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS promo_code TEXT;
CREATE INDEX IF NOT EXISTS idx_quotes_promo_code ON quotes(promo_code) WHERE promo_code IS NOT NULL;
