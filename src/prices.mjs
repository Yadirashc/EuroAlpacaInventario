export function parsePrice(value){
 const text=String(value??'').trim().replace(',','.');
 if(!text)return null;
 if(!/^\d{1,8}(\.\d{1,2})?$/.test(text))throw new Error('Ingresa un precio positivo con hasta dos decimales.');
 const price=Number(text);if(price<=0)throw new Error('El precio debe ser mayor que cero. Deja el campo vacío si falta confirmar.');
 return price;
}
export function formatPrice(item){return item.sale_price==null?'Por confirmar':new Intl.NumberFormat('es-PE',{style:'currency',currency:item.price_currency||'PEN'}).format(Number(item.sale_price));}
