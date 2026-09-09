// Prueba lógica con sustituto de D3; no verifica el renderizado visual.
process.chdir(require('node:path').resolve(__dirname,'..'));
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Selection {
 attr(){return this;}classed(){return this;}style(){return this;}text(){return this;}
 select(){return new Selection();}selectAll(){return new Selection();}append(){return new Selection();}remove(){return this;}
 data(){return this;}join(){return this;}on(){return this;}each(){return this;}filter(){return this;}
 call(fn,...args){if(typeof fn==='function')fn(this,...args);return this;}
}
const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',value:'',scrollIntoView(){}});return elements.get(id);};
// CSV mínimo compatible con campos entre comillas y comillas escapadas.
function csv(file) {
 const rows=[];let row=[],value='',quoted=false;
 const input=fs.readFileSync(file,'utf8');
 for(let i=0;i<input.length;i++) {
  const c=input[i];
  if(c==='"') {if(quoted && input[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(!quoted && (c===',' || c==='\n')) {row.push(value.replace(/\r$/,''));value='';if(c==='\n'){rows.push(row);row=[];}}
  else value+=c;
 }
 if(value||row.length){row.push(value);rows.push(row);}
 const keys=rows.shift();return rows.map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]])));
}
const d3={csv:async(p,c)=>csv(p).map(c||((x)=>x)),json:async p=>JSON.parse(fs.readFileSync(p)),
select:()=>new Selection(),selectAll:()=>new Selection(),min:(a,f)=>Math.min(...a.map(f)),max:(a,f)=>Math.max(...a.map(f)),zoomIdentity:{translate(){return this;},scale(){return this;}},drag:()=>({container(){return this;},clickDistance(){return this;},on(){return this;}})};
const ctx={d3,Selection,console,document:{getElementById:element,querySelector:()=>({scrollTop:0})},window:{matchMedia:()=>({matches:false})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/catalogo.js','utf8'),ctx);const source=fs.readFileSync('js/mapa.js','utf8').replace('  init();',`  globalThis.testAPI={state,loadData,selectNode,setExpanded,drawScene,drawActors,openSubdomain,selectActor,locateActor,
 prepare(){svg=world=nodeSelection=linkSelection=actorLayer=actorLinks=subdomainLayer=subdomainLinks=new Selection();zoom={transform(){}};}};`);
vm.runInContext(source,ctx);
(async()=>{
const api=ctx.testAPI;await api.loadData();api.prepare();const center=api.state.nodes.find(n=>n.tipo==='centro');
for(const domain of api.state.nodes.filter(n=>n.tipo==='dominio')){
 api.selectNode(domain);assert.equal(api.state.expanded,domain.id);assert.equal(api.state.visibleActors.length,0);
 const groups=ctx.Catalogo.subdomains(api.state.actors,domain.id);
 const reached=[];
 for(let page=0;page<Math.ceil(groups.length/8);page++) {
  api.state.page=page;api.drawScene();reached.push(...api.state.visibleSubdomains.map(g=>g.nombre));
 }
 assert.equal(new Set(reached).size,groups.length);
 for(const group of groups) {
  api.openSubdomain(group.nombre);
  assert.equal(api.state.visibleSubdomains.length,1);
  const expected=ctx.Catalogo.filter(api.state.actors,{domain:domain.id,subdomain:group.nombre});
  const ids=[];
  for(let page=0;page<Math.ceil(expected.length/8);page++) {
   api.state.page=page;api.drawScene();
   for(const actor of api.state.visibleActors) {
    ids.push(actor.id);api.selectActor(actor);assert.equal(element('actor-title').textContent,actor.nombre);
   }
  }
  assert.equal(new Set(ids).size,expected.length);
 }
 api.setExpanded(domain.id);assert.equal(api.state.visibleActors.length,0);assert.equal(api.state.subdomain,'');
 assert.equal(center.x,0);assert.equal(center.y,0);
}
api.setExpanded('all');api.state.query='curriculum nacional base';api.drawActors();assert.equal(api.state.visibleActors.length,1);
const cn=api.state.visibleActors[0];api.selectActor(cn);assert.equal(element('actor-type').textContent,'Instrumento curricular');
const mineduc=api.state.actors.find(a=>a.id===cn.vinculos[0].destino);api.setExpanded(mineduc.dominio);api.openSubdomain(mineduc.asignaciones.find(a=>a.dominio===mineduc.dominio).subdominio);api.locateActor(mineduc);assert.equal(api.state.actorSelected,mineduc.id);
api.state.query='zzzz-inexistente';api.drawActors();assert.equal(api.state.visibleActors.length,0);
api.selectNode(center);assert.equal(api.state.expanded,null);assert.equal(api.state.selected,center.id);
console.log('Navegación por todos los subdominios y fichas correcta: apertura/cierre en 8 dominios, páginas, fichas, CNB→MINEDUC, búsqueda vacía y restablecimiento lógico. Renderizador sustituido; no es prueba visual.');
})().catch(e=>{console.error(e);process.exitCode=1;});
