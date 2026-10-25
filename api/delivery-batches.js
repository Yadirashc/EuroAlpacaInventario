import {context,fail} from '../server/textile-auth.mjs';
import {listDeliveryBatches,saveDeliveryBatch} from '../server/delivery-batches.mjs';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{const c=await context(req);if(req.method==='GET')return res.json(await listDeliveryBatches(c));if(req.method==='POST')return res.json(await saveDeliveryBatch(c,req.body||{}));return res.status(405).json({error:'Acción no disponible'});}catch(error){return fail(res,error);}}
export const maxDuration=60;
