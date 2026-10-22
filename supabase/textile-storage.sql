-- Bucket privado. No se añaden políticas de lectura anónima o por URL pública.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('textile-private','textile-private',false,20000000,ARRAY['image/webp'])
ON CONFLICT(id) DO NOTHING;
