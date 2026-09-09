// Pruebas de consulta, paginación y geometría. No requieren navegador ni D3.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/seleccion-actores.json'),'utf8'));
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'js/catalogo.js'),'utf8'),context);
const {filter,paginate,positions}=context.Catalogo;
const all=data.actores;
assert.equal(filter(all).length,all.length);
for(const domain of new Set(all.flatMap(a=>a.dominios))){
 const records=filter(all,{domain});
 const visited=[];
 for(let page=0;page<paginate(records).pages;page++){
  const result=paginate(records,page);
  assert(result.items.length<=8);visited.push(...result.items.map(a=>a.id));
 }
 assert.equal(new Set(visited).size,records.length,'Todos los registros deben ser accesibles');
 assert.deepEqual(new Set(visited),new Set(records.map(a=>a.id)));
 for(const subdomain of new Set(records.flatMap(a=>a.asignaciones.filter(x=>x.dominio===domain).map(x=>x.subdominio)))){
  assert(filter(all,{domain,subdomain}).every(a=>a.asignaciones.some(x=>x.dominio===domain&&x.subdominio===subdomain)));
 }
}
assert.equal(filter(all,{query:'ministerios',type:'actor'}).filter(a=>a.tipo==='Ministerio').length,7);
assert(filter(all,{query:'mineduc'}).some(a=>a.tipo==='Ministerio'));
assert(filter(all,{query:'curriculum nacional base'}).some(a=>a.nombre.includes('(CNB)')));
assert(filter(all,{query:'cooperativas'}).some(a=>a.nombre==='Sistema MICOOPE'));
assert.equal(filter(all,{query:'zzzz-inexistente-zzzz'}).length,0);
assert.equal(paginate([],99).page,0);
assert.equal(paginate(all,-1).page,0);
assert.equal(paginate(all,999).page,Math.ceil(all.length/8)-1);
for(let count=1;count<=8;count++){
 const points=positions(all.slice(0,count));
 assert(points.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)));
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  assert(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>350);
 }
}
assert.deepEqual(positions(all.slice(0,8)),positions(all.slice(0,8)));
console.log('Correcto: todos los registros accesibles, ocho dominios, filtros combinados, búsqueda sin tildes, siete ministerios, CNB y posiciones estables.');

for (const domain of new Set(all.flatMap(a=>a.dominios))) {
 const groups=context.Catalogo.subdomains(all,domain);
 assert(groups.length>0);
 assert.equal(new Set(groups.map(g=>g.id)).size,groups.length);
 for (const group of groups) assert.equal(group.count,filter(all,{domain,subdomain:group.nombre}).length);
}
const repeated=[all[0],all[0]];
for(const group of context.Catalogo.subdomains(repeated,all[0].dominio)) assert.equal(group.count,1);
for(let count=1;count<=8;count++){
 const points=context.Catalogo.branchPositions(all.slice(0,count),{x:0,y:-530});
 assert.deepEqual(points,context.Catalogo.branchPositions(all.slice(0,count),{x:0,y:-530}));
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++) assert(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>240);
}
console.log('Subdominios: conteos únicos y geometría determinista verificados.');
for(let count=1;count<=8;count++) {
 const domain={x:180,y:-280};
 const points=context.Catalogo.domainPositions(all.slice(0,count),domain);
 for(const point of points) assert(Math.abs(Math.hypot(point.x-domain.x,point.y-domain.y)-380)<1e-8);
 assert.equal(domain.x,180);assert.equal(domain.y,-280);
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++) assert(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>290);
}
console.log('Composición radial alrededor del dominio y separación entre categorías verificadas.');
