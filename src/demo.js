export const demoItems=[
 ['EA-0001','SUYAY','VESTIDO','Baby Alpaca + Algodón','15% Baby Alpaca · 85% Algodón Tanguis','BEIGE','1348','S',8,'España'],
 ['EA-0001','SUYAY','VESTIDO','Baby Alpaca + Algodón','15% Baby Alpaca · 85% Algodón Tanguis','OLIVO','7383','M',3,'Lima'],
 ['EA-0002','NINA','CARDIGAN','Baby Alpaca','100% Baby Alpaca','OATMEAL','1258','M',12,'Lima'],
 ['EA-0003','ARUMA','VESTIDO','Baby Alpaca','100% Baby Alpaca','NEGRO','500','L',1,'Lima'],
 ['EA-0004','ALLIN','BUFANDA','Baby Alpaca + Algodón','15% Baby Alpaca · 85% Algodón Tanguis','GUINDA','6330','ÚNICA',18,'España'],
 ['EA-0005','QORI','CHOMPA','Baby Alpaca','100% Baby Alpaca','MOSTAZA','2618','M',2,'Lima'],
 ['EA-0006','ILLARI','CHAL','Baby Alpaca + Microfibra','30% Baby Alpaca · 70% Microfibra','HUESO','201','ÚNICA',6,'España'],
 ['EA-0007','KINTI','CHOMPA','Baby Alpaca + Algodón','15% Baby Alpaca · 85% Algodón Tanguis','BEIGE','1348','S',null,'Muestras / revisión']
].map(a=>({id:crypto.randomUUID(),model_code:a[0],name:a[1],category:a[2],material:a[3],composition:a[4],color:a[5],color_code:a[6],size:a[7],quantity:a[8],location:a[9],sku:`${a[0]}-BA-${a[6]}-${a[7]}`,description:'Ejemplo de demostración. No representa el inventario real.',supplier:'ITESSA',production_state:'TERMINADO',status:'DISPONIBLE',min_stock:2,review_required:a[8]===null,archived:false,notes:'',material_code:'BA'}));
