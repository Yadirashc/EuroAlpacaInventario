export function bindInventoryTextileForm(dialog,textile,item){
 const form=dialog.querySelector('#item-form'),picker=form?.elements.registered_color;if(!picker||!textile)return;
 function apply(){const color=textile.garmentColorChoices(item).find(c=>c.id===picker.value);if(!color)return;
  for(const key of ['color','color_code','supplier','commercial_name','material','material_code','composition','yarn_title'])if(form.elements[key]&&color[key]!==undefined)form.elements[key].value=color[key];
  form.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function refresh(selected=picker.value){const choices=textile.garmentColorChoices(item),legacy=[...picker.options].find(o=>o.value==='legacy');picker.replaceChildren(new Option('Selecciona un color de Gestión textil',''));
  if(legacy)picker.add(legacy);
  for(const color of choices)picker.add(new Option([color.name,color.code,color.yarn_name,color.supplier].filter(Boolean).join(' · '),color.id));picker.value=selected;
 }
 refresh(item?.textile_color_id||item?.source_snapshot?._textile_color_id||picker.value);picker.addEventListener('change',apply);
 dialog.querySelector('[data-create-inventory-textile]')?.addEventListener('click',()=>{
  dialog.close();
  const resume=id=>{document.body.append(dialog);dialog.showModal();if(id){refresh(id);apply();}};
  textile.createInventoryColor(resume,()=>resume());
 });
}
