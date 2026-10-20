-- Ejecutar después de logistics.sql en Supabase (bucket privado).
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('logistics-private','logistics-private',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS logistics_document_read ON storage.objects;
CREATE POLICY logistics_document_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='logistics-private' AND public.user_role() IS NOT NULL AND EXISTS(SELECT 1 FROM public.logistics_documents d WHERE d.path=storage.objects.name));
DROP POLICY IF EXISTS logistics_document_insert ON storage.objects;
CREATE POLICY logistics_document_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='logistics-private' AND public.user_role() IN ('admin','operadora') AND EXISTS(SELECT 1 FROM public.logistics_shipments s WHERE s.id::text=split_part(name,'/',1)) AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$');
COMMIT;
