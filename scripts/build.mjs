import fs from 'node:fs';
fs.mkdirSync('dist',{recursive:true});fs.cpSync('src','dist/src',{recursive:true});fs.cpSync('public','dist',{recursive:true});fs.copyFileSync('index.html','dist/index.html');
const url=process.env.VITE_SUPABASE_URL||'',key=process.env.VITE_SUPABASE_ANON_KEY||'';
if((url&&!key)||(!url&&key))throw new Error('Configura ambas variables públicas de Supabase');
fs.writeFileSync('dist/config.js','window.EURO_CONFIG='+JSON.stringify({url,key})+';');
console.log('Build listo. Inventario privado excluido de dist. '+(url?'Supabase configurado.':'Vista de demostración sin datos privados.'));
