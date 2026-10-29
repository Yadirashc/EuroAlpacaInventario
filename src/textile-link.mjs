import {normalize} from './domain.mjs';
import {compositionKey} from './composition.mjs';
import {providerKey,colorCode} from './photo-identity.mjs';
export const textileText=value=>normalize(value).replace(/[^A-Z0-9]/g,'');
export function sharedYarnKey(yarn,supplier){return JSON.stringify([providerKey(supplier?.code||supplier?.name||yarn.supplier),textileText(yarn.name||yarn.commercial_name),compositionKey(yarn.composition),textileText(yarn.fiber||yarn.material)]);}
export function sharedColorKey(color,yarn,supplier){const code=textileText(colorCode({code:color.code??color.color_code,provider:supplier?.code||supplier?.name||yarn.supplier}));return sharedYarnKey(yarn,supplier)+'|'+(code?'code:'+code:'name:'+textileText(color.name||color.color));}
export function textileColorSelection(data,id){const color=data.colors.find(c=>c.id===id&&c.active!==false&&!c.deleted_at),yarn=color&&data.yarns.find(y=>y.id===color.yarn_id&&y.active!==false&&!y.deleted_at),supplier=yarn&&data.suppliers.find(s=>s.id===yarn.supplier_id&&s.active!==false&&!s.deleted_at);return color&&yarn&&supplier?{id:color.id,name:color.name,code:color.code||'',yarn_id:yarn.id,yarn_name:yarn.name,supplier:supplier.name,material:yarn.fiber,composition:yarn.composition,commercial_name:yarn.name,material_code:yarn.code||'',yarn_title:yarn.title||'',color:color.name,color_code:color.code||''}:null;}
