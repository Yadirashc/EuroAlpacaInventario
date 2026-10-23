BEGIN;
CREATE OR REPLACE FUNCTION public.confirm_color_photo_server(p_photo jsonb,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE photo public.textile_photos;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='admin' AND active) THEN
  RAISE EXCEPTION 'Responsable de sincronización no autorizado';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_photo->>'color_id',0));
 SELECT * INTO photo FROM textile_photos WHERE color_id=(p_photo->>'color_id')::uuid
  AND stage=p_photo->>'stage' AND active AND deleted_at IS NULL AND verification_status='verified' LIMIT 1;
 IF FOUND THEN RETURN to_jsonb(photo);END IF;
 SELECT * INTO photo FROM jsonb_populate_record(NULL::textile_photos,p_photo);
 photo.verified_by=p_actor;photo.active=true;photo.updated_at=now();photo.created_at=now();
 INSERT INTO textile_photos SELECT (photo).* RETURNING * INTO photo;
 RETURN to_jsonb(photo);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_color_photo_server(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_color_photo_server(jsonb,uuid) TO service_role;
COMMIT;
