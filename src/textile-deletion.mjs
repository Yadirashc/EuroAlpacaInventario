import {normalize} from './domain.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function textileDeletionBlocker(kind,row,data){
 if(kind==='yarns'){
  const count=data.colors.filter(color=>!color.deleted_at&&color.yarn_id===row.id).length;
  return count?'Elimina primero sus '+count+' colores vinculados.':'';
 }
 if(data.stock.some(stock=>stock.color_id===row.id&&Number(stock.stock_kg)>0))return 'Tiene stock de hilo. Registra el ajuste de kilos antes de eliminarlo.';
 if(data.requirements.some(req=>req.color_id===row.id&&!req.deleted_at&&!['Cancelado','Recibido completamente'].includes(req.status)))return 'Tiene requerimientos pendientes. Finalízalos o cancélalos primero.';
 return '';
}

export function createTextileDeletion(ctx){
 let kind='colors',query='',selected=new Set();
 const plural=()=>kind==='colors'?'colores':'hilos';
 const entity=()=>kind==='colors'?'textile_colors':'textile_yarns';
 function rows(){
  const data=ctx.data();return data[kind].filter(row=>!row.deleted_at).filter(row=>{
   const yarn=kind==='colors'?data.yarns.find(y=>y.id===row.yarn_id):row,provider=data.suppliers.find(s=>s.id===yarn?.supplier_id);
   return !query||normalize([row.name,row.code,yarn?.name,yarn?.title,provider?.name].join(' ')).includes(normalize(query));
  }).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es')||String(a.code).localeCompare(String(b.code),'es',{numeric:true}));
 }
 function available(){const data=ctx.data();return rows().filter(row=>!textileDeletionBlocker(kind,row,data));}
 function render(){
  if(!ctx.admin())return ctx.heading('Eliminar hilos y colores','Acceso exclusivo de administradora.');
  const data=ctx.data(),list=rows(),eligible=available(),allowed=new Set(eligible.map(row=>row.id));selected=new Set([...selected].filter(id=>allowed.has(id)));
  return ctx.heading('Eliminar hilos y colores','Gestión textil · Retira los registros que ya no necesitas.','<button class="secondary" data-textile-delete-back>Volver al catálogo</button>')+
   '<section class="panel padded textile-delete-panel"><p>Selecciona colores o hilos y revisa la lista antes de eliminarlos. Las prendas, sus cantidades y las fotografías se conservan. Puedes recuperar los registros en Papelera.</p>'+
   '<div class="textile-delete-tabs" role="group" aria-label="Tipo de registro">'+[['colors','Colores'],['yarns','Hilos']].map(([key,label])=>'<button type="button" class="'+(kind===key?'primary':'secondary')+'" data-textile-delete-kind="'+key+'" aria-pressed="'+(kind===key)+'">'+label+' ('+data[key].filter(row=>!row.deleted_at).length+')</button>').join('')+'</div>'+
   '<div class="filter-bar textile-delete-tools"><label class="search">Buscar '+plural()+'<input id="textile-delete-search" type="search" value="'+esc(query)+'" placeholder="Nombre, código o proveedor"></label><button class="danger" id="textile-delete-selected" '+(!selected.size?'disabled':'')+'>Eliminar seleccionados ('+selected.size+')</button><button class="secondary" data-textile-delete-trash>Ir a Papelera</button></div>'+
   '<p class="panel-note">Para eliminar un hilo, elimina primero sus colores. Los colores con stock o requerimientos pendientes indican qué debes resolver.</p>'+
   '<div class="textile-table-wrap"><table class="textile-table textile-delete-table"><thead><tr><th><input type="checkbox" id="textile-delete-all" aria-label="Seleccionar todos los registros disponibles" '+(eligible.length&&eligible.every(row=>selected.has(row.id))?'checked':'')+' '+(!eligible.length?'disabled':'')+'></th><th>'+(kind==='colors'?'Color / código':'Hilo / referencia')+'</th><th>'+(kind==='colors'?'Hilo':'Título')+'</th><th>Proveedor</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+
   list.map(row=>{
    const yarn=kind==='colors'?data.yarns.find(y=>y.id===row.yarn_id):row,provider=data.suppliers.find(s=>s.id===yarn?.supplier_id),block=textileDeletionBlocker(kind,row,data),label=(kind==='colors'?'color ':'hilo ')+row.name+(row.code?' · '+row.code:'');
    return '<tr data-textile-delete-row="'+esc(row.id)+'"><td><input type="checkbox" data-textile-delete-check="'+esc(row.id)+'" aria-label="Seleccionar '+esc(label)+'" '+(selected.has(row.id)?'checked':'')+' '+(block?'disabled':'')+'></td><td><strong>'+esc(row.name||'Sin nombre')+'</strong><small>'+esc(row.code||'Sin código')+'</small></td><td>'+esc(kind==='colors'?yarn?.name||'Hilo eliminado':yarn.title||'Sin título')+'</td><td>'+esc(provider?.name||'Sin proveedor')+'</td><td>'+esc(block||'Disponible para eliminar')+'</td><td><button class="danger secondary" data-textile-delete-one="'+esc(row.id)+'" '+(block?'disabled':'')+'>Eliminar</button></td></tr>';
   }).join('')+(!list.length?'<tr><td colspan="6" class="empty">No hay '+plural()+' para eliminar'+(query?' con esta búsqueda':'')+'.</td></tr>':'')+'</tbody></table></div></section>';
 }
 function remove(ids){
  if(!ctx.admin())return;
  const requested=new Set(ids),chosen=available().filter(row=>requested.has(row.id));
  if(!chosen.length)return;
  if(chosen.length>500)return ctx.toast('Selecciona hasta 500 registros por eliminación.',true);
  ctx.deleteRecords(entity(),chosen,plural());
 }
 function bind(){
  if(!ctx.admin())return;
  document.querySelector('[data-textile-delete-back]')?.addEventListener('click',ctx.back);
  document.querySelector('[data-textile-delete-trash]')?.addEventListener('click',()=>ctx.navigate('trash'));
  document.querySelectorAll('[data-textile-delete-kind]').forEach(button=>button.onclick=()=>{kind=button.dataset.textileDeleteKind;query='';selected.clear();ctx.render();});
  document.querySelector('#textile-delete-search')?.addEventListener('input',event=>{query=event.target.value;selected.clear();ctx.render();const input=document.querySelector('#textile-delete-search');input?.focus();});
  document.querySelector('#textile-delete-all')?.addEventListener('change',event=>{selected=event.target.checked?new Set(available().slice(0,500).map(row=>row.id)):new Set();ctx.render();});
  document.querySelectorAll('[data-textile-delete-check]').forEach(input=>input.onchange=()=>{if(input.checked&&selected.size>=500){input.checked=false;return ctx.toast('Selecciona hasta 500 registros por eliminación.',true);}if(input.checked)selected.add(input.dataset.textileDeleteCheck);else selected.delete(input.dataset.textileDeleteCheck);ctx.render();});
  document.querySelectorAll('[data-textile-delete-one]').forEach(button=>button.onclick=()=>remove([button.dataset.textileDeleteOne]));
  document.querySelector('#textile-delete-selected')?.addEventListener('click',()=>remove([...selected]));
 }
 return {render,bind,reset(){kind='colors';query='';selected.clear();}};
}
