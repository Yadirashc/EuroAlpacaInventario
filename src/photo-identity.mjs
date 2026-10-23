import {normalize} from './domain.mjs';
import {compositionKey} from './composition.mjs';
const key=value=>normalize(value).replace(/\s+/g,' ');
export const providerKey=value=>{const p=key(value).replace(/[^A-Z]/g,'');return p==='ITESSA'?'itessa':p==='MICHELL'?'michell':['INCATOPS','ESSENTIALS','ESSENTIALSPERU','STOCKSERVICEESSENTIALS'].includes(p)?'incatops':p;};
export function colorCode(identity){const value=String(identity.code||'').trim().toUpperCase();return providerKey(identity.provider)==='itessa'?value.replace(/^(?:NU|BA|BM|ZZ)(?:\s*-\s*|\s+)/,''):value;}
export function sameVariant(a,b){
 if(!a||!b||!a.code||!b.code||!a.yarn||!b.yarn||!a.composition||!b.composition||!a.title||!b.title)return false;
 return providerKey(a.provider)===providerKey(b.provider)&&key(a.yarn)===key(b.yarn)&&colorCode(a)===colorCode(b)&&compositionKey(a.composition)===compositionKey(b.composition)&&key(a.title).replace(/\s/g,'')===key(b.title).replace(/\s/g,'')&&key(a.fiber)===key(b.fiber)&&(!a.supplier_id||!b.supplier_id||a.supplier_id===b.supplier_id);
}
export const verifiedPhoto=(photos,i)=>photos.find(p=>p.active!==false&&!p.deleted_at&&p.rights_confirmed&&p.verification_status==='verified'&&(p._url||p.storage_full&&p.storage_thumb)&&sameVariant(p.source_identity,i));
