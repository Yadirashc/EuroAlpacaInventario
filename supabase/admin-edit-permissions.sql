-- Las fichas enlazan colores mediante source_snapshot. RLS sigue limitando UPDATE a admin.
BEGIN;
GRANT UPDATE(source_snapshot) ON public.items TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
