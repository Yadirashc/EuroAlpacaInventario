import fs from 'node:fs';
fs.mkdirSync('dist',{recursive:true});fs.cpSync('src','dist/src',{recursive:true});fs.cpSync('public','dist',{recursive:true});fs.copyFileSync('index.html','dist/index.html');
const url=process.env.VITE_SUPABASE_URL||'',key=process.env.VITE_SUPABASE_ANON_KEY||'';
if((url&&!key)||(!url&&key))throw new Error('Configura ambas variables públicas de Supabase');
fs.mkdirSync('dist/vendor',{recursive:true});fs.copyFileSync('node_modules/exceljs/dist/exceljs.min.js','dist/vendor/exceljs.min.js');
fs.writeFileSync('dist/config.js','window.EURO_CONFIG='+JSON.stringify({url,key,textile:true,textilePreview:process.env.VERCEL_ENV!=='production'})+';');
console.log('Build listo. Inventario privado excluido de dist. '+(url?'Supabase configurado.':'Vista de demostración sin datos privados.'));
if(process.env.VERCEL_ENV==='production'){
 const {standardizeTextiles}=await import('./standardize-textiles.mjs');
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Falta la conexión de servidor para unificar el catálogo textil.');
 console.log('TEXTILE_CATALOG_RESULT '+JSON.stringify(await standardizeTextiles({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY})));
}
