-- Crea tu cuenta en Supabase > Authentication > Users > Add user.
-- Sustituye el correo y ejecuta este archivo en SQL Editor.
INSERT INTO public.profiles(id,email,full_name,role,active)
SELECT id,email,'Yadira','admin',true FROM auth.users WHERE lower(email)=lower('CAMBIA-POR-TU-CORREO')
ON CONFLICT(id) DO UPDATE SET full_name='Yadira',role='admin',active=true;
SELECT email,role,active FROM public.profiles WHERE role='admin';
