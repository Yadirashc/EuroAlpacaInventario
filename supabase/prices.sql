BEGIN;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sale_price numeric(10,2) CHECK(sale_price>0);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'PEN' CHECK(price_currency IN ('PEN','USD','EUR'));
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;
CREATE OR REPLACE FUNCTION public.stamp_item_price() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.price_updated_at=CASE WHEN NEW.sale_price IS NULL THEN NULL ELSE now() END;
 ELSIF (NEW.sale_price,NEW.price_currency) IS DISTINCT FROM (OLD.sale_price,OLD.price_currency) THEN
  NEW.price_updated_at=now();
 ELSE
  NEW.price_updated_at=OLD.price_updated_at;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS stamp_price ON public.items;
CREATE TRIGGER stamp_price BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.stamp_item_price();
REVOKE ALL ON FUNCTION public.stamp_item_price() FROM PUBLIC;
GRANT UPDATE(sale_price,price_currency) ON public.items TO authenticated;
COMMIT;
