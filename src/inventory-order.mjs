import {normalize} from './domain.mjs';

const alphabet=new Intl.Collator('es',{sensitivity:'base',numeric:true});
const text=value=>String(value??'').trim().replace(/\s+/g,' ');
export const compareText=(a,b)=>alphabet.compare(text(a),text(b));
function sizeRank(value){
 const size=normalize(value).replace(/\s+/g,'');
 if(size==='S')return 0;
 if(size==='M')return 1;
 if(size==='L')return 2;
 const xs=size.match(/^(X+)S$/),xl=size.match(/^(X+)L$/),numbered=size.match(/^(\d+)X([SL])$/);
 if(xs)return -xs[1].length;
 if(xl)return 2+xl[1].length;
 if(numbered)return numbered[2]==='S'?-Number(numbered[1]):2+Number(numbered[1]);
 if(/^\d+(?:[.,]\d+)?$/.test(size))return 100+Number(size.replace(',','.'));
 if(['U','UNICA','TALLAUNICA','OS','ONESIZE','NOCALIFICA'].includes(size))return 1000;
 return size?2000:3000;
}
export const compareSizes=(a,b)=>sizeRank(a)-sizeRank(b)||compareText(a,b);
export const compareInventory=(a,b)=>compareText(a.name,b.name)||compareText(a.color,b.color)||compareSizes(a.size,b.size)||compareText(a.location,b.location)||compareText(a.material,b.material)||compareText(a.composition,b.composition)||compareText(a.category,b.category)||compareText(a.model_code,b.model_code)||compareText(a.id,b.id);
export const sortInventory=rows=>[...rows].sort(compareInventory);
