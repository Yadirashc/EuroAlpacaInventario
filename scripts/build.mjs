import fs from 'node:fs';
fs.mkdirSync('dist',{recursive:true});fs.cpSync('src','dist/src',{recursive:true});fs.cpSync('public','dist',{recursive:true});fs.copyFileSync('index.html','dist/index.html');
const url=process.env.VITE_SUPABASE_URL||'',key=process.env.VITE_SUPABASE_ANON_KEY||'';
if((url&&!key)||(!url&&key))throw new Error('Configura ambas variables públicas de Supabase');
fs.mkdirSync('dist/vendor',{recursive:true});fs.copyFileSync('node_modules/exceljs/dist/exceljs.min.js','dist/vendor/exceljs.min.js');
fs.writeFileSync('dist/config.js','window.EURO_CONFIG='+JSON.stringify({url,key,textile:true,textilePreview:process.env.VERCEL_ENV!=='production'})+';');
console.log('Build listo. Inventario privado excluido de dist. '+(url?'Supabase configurado.':'Vista de demostración sin datos privados.'));
