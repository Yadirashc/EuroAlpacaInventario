BEGIN;
ALTER TABLE public.textile_photos
 ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending' CHECK(verification_status IN('pending','verified')),
 ADD COLUMN IF NOT EXISTS verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id),
 ADD COLUMN IF NOT EXISTS source_url text,
 ADD COLUMN IF NOT EXISTS source_image_url text,
 ADD COLUMN IF NOT EXISTS source_checked_at timestamptz,
 ADD COLUMN IF NOT EXISTS permission_reference text,
 ADD COLUMN IF NOT EXISTS source_identity jsonb,
 ADD COLUMN IF NOT EXISTS content_hash text,
 ADD COLUMN IF NOT EXISTS storage_name text,
 ADD COLUMN IF NOT EXISTS storage_asset_id uuid REFERENCES public.textile_photos(id);
CREATE TABLE IF NOT EXISTS public.textile_photo_checks(
 stage text NOT NULL CHECK(stage IN('production','preview')),
 color_id uuid NOT NULL,
 identity_key text NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL,
 reason text NOT NULL,
 candidates jsonb NOT NULL DEFAULT '[]',
 PRIMARY KEY(stage,color_id),
 FOREIGN KEY(color_id,stage) REFERENCES public.textile_colors(id,stage)
);
CREATE TABLE IF NOT EXISTS public.textile_photo_sources(
 stage text NOT NULL,source_key text NOT NULL,checked_at timestamptz NOT NULL DEFAULT now(),
 result jsonb NOT NULL,PRIMARY KEY(stage,source_key)
);
ALTER TABLE public.textile_photo_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textile_photo_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY checks_admin_read ON public.textile_photo_checks FOR SELECT TO authenticated USING(public.user_role()='admin');
GRANT SELECT ON public.textile_photo_checks TO authenticated;
GRANT ALL ON public.textile_photo_checks,public.textile_photo_sources TO service_role;
-- Prevent an ordinary photo edit from certifying an unverified color or changing its identity.
CREATE OR REPLACE FUNCTION public.guard_color_photo_verification() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.color_id IS NOT NULL AND NEW.verification_status='verified' THEN
  IF NEW.verified_at IS NULL OR NEW.verified_by IS NULL OR NOT NEW.rights_confirmed
    OR length(trim(coalesce(NEW.permission_reference,'')))<5 OR NEW.source_identity IS NULL
    OR NEW.source_identity->>'color_id' IS DISTINCT FROM NEW.color_id::text
    OR NEW.source_identity->>'yarn_id' IS DISTINCT FROM NEW.yarn_id::text THEN
   RAISE EXCEPTION 'La fotografía requiere coincidencia exacta y autorización documentada';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.color_id IS DISTINCT FROM OLD.color_id OR NEW.yarn_id IS DISTINCT FROM OLD.yarn_id) THEN
   NEW.verification_status='pending';NEW.verified_at=NULL;NEW.verified_by=NULL;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER color_photo_verification BEFORE INSERT OR UPDATE ON public.textile_photos FOR EACH ROW EXECUTE FUNCTION public.guard_color_photo_verification();
CREATE FUNCTION public.confirm_color_photo(p_photo jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE row public.textile_photos;
BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo administradora';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_photo->>'color_id',0));
 IF EXISTS(SELECT 1 FROM textile_photos WHERE color_id=(p_photo->>'color_id')::uuid AND stage=p_photo->>'stage' AND active AND deleted_at IS NULL AND verification_status='verified') THEN
  RAISE EXCEPTION 'Este color ya tiene una fotografía verificada';
 END IF;
 SELECT * INTO row FROM jsonb_populate_record(NULL::textile_photos,p_photo);
 row.active=true;row.updated_at=now();
 INSERT INTO textile_photos SELECT (row).* RETURNING * INTO row;
 RETURN to_jsonb(row);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_color_photo(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_color_photo(jsonb) TO authenticated;
COMMIT;
