/* Operaciones puras del catálogo; independientes de D3 y del navegador. */
(() => {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function filter(records,{domain=null,subdomain='',type='',query=''}={}) {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    return records.filter(record => {
      const assignments = record.asignaciones.filter(a => !domain || a.dominio === domain);
      return assignments.length && (!subdomain || assignments.some(a => a.subdominio === subdomain)) &&
        (!type || record.naturaleza === type) && words.every(word => normalize([
          record.nombre,record.etiqueta,record.tipo,...(record.alias || []),...(record.palabras_clave || []),
          ...record.asignaciones.map(a => a.subdominio)
        ].join(' ')).includes(word));
    });
  }
  function paginate(records,page=0,size=8) {
    const pages = Math.max(1,Math.ceil(records.length/size));
    const current = Math.max(0,Math.min(page,pages-1));
    return {items:records.slice(current*size,(current+1)*size),page:current,pages,total:records.length};
  }
  function positions(records,angle=0) {
    return records.map((record,i) => ({...record,
      x:Math.cos(angle+i*2*Math.PI/Math.max(records.length,1))*530,
      y:Math.sin(angle+i*2*Math.PI/Math.max(records.length,1))*530}));
  }
  // Cuenta entidades únicas, aunque varias fuentes repitan su clasificación.
  function subdomains(records, domain) {
    const groups = new Map();
    records.forEach(record => record.asignaciones.filter(a => a.dominio === domain).forEach(a => {
      if (!groups.has(a.subdominio)) groups.set(a.subdominio,new Set());
      groups.get(a.subdominio).add(record.id);
    }));
    return [...groups].sort(([a],[b]) => a.localeCompare(b,'es')).map(([nombre,ids]) => ({
      id:JSON.stringify([domain,nombre]), nombre, dominio:domain, count:ids.size
    }));
  }
  // Satélites alrededor del dominio activo, sin desplazar los nodos base.
  function domainPositions(records, domain) {
    return records.map((record,i) => {
      const angle=-Math.PI/2+i*2*Math.PI/Math.max(records.length,1);
      return {...record,x:domain.x+Math.cos(angle)*380,y:domain.y+Math.sin(angle)*380};
    });
  }
  function branchPositions(records, anchor, parent={x:0,y:0}) {
    const direction = Math.atan2(anchor.y-parent.y,anchor.x-parent.x);
    return records.map((record,i) => {
      const angle = direction + (records.length === 1 ? 0 : (i/(records.length-1)-0.5)*Math.PI*4/3);
      return {...record,x:anchor.x+Math.cos(angle)*420,y:anchor.y+Math.sin(angle)*420};
    });
  }
  globalThis.Catalogo = {normalize,filter,paginate,positions,subdomains,branchPositions,domainPositions};
})();
