import {replaceModelPhoto} from '../server/model-photo.mjs';
import {preparePhotoUpload,consumePhotoUpload,discardPhotoUpload} from '../server/photo-transfer.mjs';
import {clearItemColors} from '../server/item-color-clear.mjs';
import {decodePhotoUpload} from '../server/photo-upload.mjs';
import {readColorProfiles,saveColorProfile,setColorReference} from '../server/color-profiles.mjs';
import {savePhoto} from '../server/photo-storage.mjs';
import {discoverPhotos,photoReport,confirmPhoto,colorVerification} from '../server/color-photo-catalog.mjs';
import {supplierPhotoReport,syncProviderPhotos,photoSettings,savePhotoSettings,confirmProviderCandidate,resolveRegisteredPhoto,photoScheduleAvailable} from '../server/provider-photo-sync.mjs';
import {randomUUID} from 'node:crypto';
import {context,fail,limitedBuffer} from '../server/textile-auth.mjs';
import {driveIdentity,driveGet,belongsToFolder} from '../server/drive.mjs';
import {syncDrive,syncSuppliers,configuredFeeds} from '../server/textile-sync.mjs';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const action=req.query?.action||req.body?.action||'status';try{const c=await context(req,{admin:!['media','photo-resolve','color-profiles'].includes(action)});
if(action==='color-profiles'&&req.method==='GET')return res.json({profiles:await readColorProfiles(c)});
if(action==='color-profile-save'&&req.method==='POST')return res.json(await saveColorProfile(c,req.body||{}));
if(action==='item-color-clear'&&req.method==='POST')return res.json(await clearItemColors(c,req.body||{}));
if(action==='photo-resolve'&&req.method==='GET')return res.json(await resolveRegisteredPhoto(c,req.query||{}));
if(action==='photo-discover'&&req.method==='POST')return res.json(await discoverPhotos(c));
if(action==='photo-report'&&req.method==='GET')return res.json(await supplierPhotoReport(c));
if(action==='photo-sync'&&req.method==='POST')return res.json(await syncProviderPhotos(c,req.body||{}));
if(action==='photo-settings'&&req.method==='GET')return res.json({settings:await photoSettings(c),scheduled:await photoScheduleAvailable(c)});
if(action==='photo-settings'&&req.method==='POST')return res.json(await savePhotoSettings(c,req.body||{}));
if(action==='photo-confirm-provider'&&req.method==='POST')return res.json(await confirmProviderCandidate(c,req.body||{}));
if(action==='photo-confirm'&&req.method==='POST')return res.json(await confirmPhoto(c,req.body||{}));
if(action==='status'&&req.method==='GET')return res.json({drive:driveIdentity(),feeds:configuredFeeds().map(f=>({supplier:f.supplier,format:f.format})),scheduled:process.env.TEXTILE_SYNC_ENABLED==='true',stage:c.stage});
if(action==='sync-drive'&&req.method==='POST')return res.json({results:await syncDrive(c,req.body.folder_id)});
if(action==='sync-suppliers'&&req.method==='POST')return res.json({results:await syncSuppliers(c)});
if(action==='prepare-upload'&&req.method==='POST')return res.json(await preparePhotoUpload(c,req.body||{}));
if(action==='discard-upload'&&req.method==='POST'){await discardPhotoUpload(c,req.body?.upload_path);return res.json({discarded:true});}
if(action==='upload'&&req.method==='POST'){const b=req.body||{};const raw=b.upload_path?await consumePhotoUpload(c,b.upload_path):undefined;const buffer=await decodePhotoUpload(b,raw);if(b.replace_photo_id)return res.status(200).json(await replaceModelPhoto(c,b,buffer));const verification=await colorVerification(c,b,{manual:true});const id=randomUUID(),paths=await savePhoto(c,id,buffer,{color:!!b.color_id});const photoBody={id,stage:c.stage,name:String(b.name||'Fotografía').slice(0,250),kind:b.kind||'referencia',collection:String(b.collection||'').slice(0,200),model_code:String(b.model_code||'').slice(0,50),yarn_id:b.yarn_id||null,color_id:b.color_id||null,visibility:b.visibility==='team'?'team':'admin',rights_confirmed:true,mime_type:'image/webp',...paths,...verification,source_url:b.color_id?'manual':null,storage_name:id+'.webp'};const photo=(await c.db('textile_photos',{method:'POST',body:photoBody}))[0];if(b.color_id)await setColorReference(c,b.color_id,id);return res.status(201).json(photo);}
if(action==='media'&&req.method==='GET'){const id=String(req.query.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(404).end();const [photo]=await c.db('textile_photos?id=eq.'+id+'&stage=eq.'+c.stage+'&active=eq.true');if(!photo||!photo.rights_confirmed||(photo.visibility==='admin'&&c.profile.role!=='admin'))return res.status(404).end();if(photo.drive_file_id&&!photo.folder_id)return res.status(404).end();if(photo.folder_id){const [folder]=await c.db('textile_drive_folders?id=eq.'+photo.folder_id,{service:true});if(!folder?.active||!folder.rights_confirmed||(folder.visibility==='admin'&&c.profile.role!=='admin'))return res.status(404).end();if(photo.drive_file_id&&!await belongsToFolder(photo.drive_file_id,folder.folder_id))return res.status(404).end();}
let path=req.query.size==='full'?photo.storage_full:photo.storage_thumb;if(!path&&photo.drive_file_id){const source=await driveGet('files/'+encodeURIComponent(photo.drive_file_id)+'?alt=media&supportsAllDrives=true');const buffer=await limitedBuffer(source);const paths=await savePhoto(c,photo.id,buffer);await c.db('textile_photos?id=eq.'+photo.id,{method:'PATCH',body:paths,service:true});path=req.query.size==='full'?paths.storage_full:paths.storage_thumb;}if(!path)return res.status(404).end();if(!path.startsWith(c.stage+'/'+(photo.storage_asset_id||photo.id)+'/'))throw new Error('Referencia de fotografía inválida');const r=await fetch(c.url+'/storage/v1/object/authenticated/textile-private/'+path,{headers:{apikey:c.key,Authorization:'Bearer '+c.key}});const data=await limitedBuffer(r,10_000_000);res.setHeader('Content-Type','image/webp');res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');return res.status(200).send(data);}
return res.status(405).json({error:'Acción no disponible'});
}catch(e){return fail(res,e);}}
export const config={api:{bodyParser:{sizeLimit:'4mb'}}};
export const maxDuration=60;
