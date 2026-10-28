import {randomUUID} from 'node:crypto';
import {savePhoto} from './photo-storage.mjs';

export async function replaceModelPhoto(c,body,buffer){
 if(c.profile.role!=='admin')throw Object.assign(new Error('Solo administradora'),{status:403});
 if(typeof body.replace_photo_id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.replace_photo_id))throw Error('La fotografía seleccionada no es válida.');
 const [photo]=await c.db('textile_photos?id=eq.'+body.replace_photo_id+'&stage=eq.'+c.stage+'&deleted_at=is.null&active=eq.true');
 if(!photo||photo.kind!=='producto'||!photo.model_code||photo.model_code!==body.model_code||body.color_id||body.yarn_id)throw Error('La fotografía no corresponde a este modelo. Actualiza el inventario.');
 const version=randomUUID(),paths=await savePhoto(c,photo.id,buffer,{version});
 const values={...paths,storage_asset_id:null,mime_type:'image/webp',storage_name:version+'.webp',drive_file_id:null,drive_modified_at:null,folder_id:null,yarn_id:null,color_id:null,source_url:'manual',source_image_url:null,rights_confirmed:true,active:true};
 const saved=await c.db('textile_photos?id=eq.'+photo.id+'&stage=eq.'+c.stage+'&deleted_at=is.null'+(photo.updated_at?'&updated_at=eq.'+encodeURIComponent(photo.updated_at):''),{method:'PATCH',body:values});
 if(saved.length!==1)throw Error('La fotografía cambió mientras la editabas. Actualiza e inténtalo nuevamente.');
 return saved[0];
}
