/* D3 v7 se carga antes de este archivo mediante scripts defer.
 * Geometría determinista: no hay fuerzas aleatorias ni dependencia de un framework.
 */
(() => {
  'use strict';
  const CONFIG = { width:1000, height:900, radius:280, nodeRadius:26, centerRadius:91 };
  const state = { nodes:[], links:[], selected:null, actors:[], sources:[], expanded:null, actorSelected:null, visibleActors:[], visibleSubdomains:[], activeSubdomain:null, page:0, query:'', subdomain:'', type:'' };
  const element = id => document.getElementById(id);
  let svg, world, nodeSelection, linkSelection, zoom, actorLayer, actorLinks, actorSelection, subdomainLayer, subdomainLinks, subdomainSelection;

  // El archivo conserva el nombre solicitado; contiene conceptos, no instituciones.
  async function loadData() {
    const [nodes, links, selection] = await Promise.all([
      d3.csv('data/actores.csv', row => ({ ...row, orden:Number(row.orden) })),
      d3.csv('data/relaciones.csv'),
      d3.json('data/seleccion-actores.json')
    ]);
    const byId = new Map(nodes.map(node => [node.id,node]));
    if (byId.size !== nodes.length || nodes.filter(n => n.tipo === 'centro').length !== 1 ||
        nodes.filter(n => n.tipo === 'dominio').length !== 8 || nodes.length !== 9 ||
        nodes.some(n => !n.id || !n.nombre || !Number.isFinite(n.orden))) {
      throw new Error('Los datos deben contener un centro y ocho dominios con identificadores únicos.');
    }
    state.nodes = nodes.sort((a,b) => a.orden-b.orden);
    const sourceIds = new Set(selection.fuentes.map(s => s.id));
    const actorIds = new Set(selection.actores.map(a => a.id));
    if (actorIds.size !== selection.actores.length || selection.actores.some(a =>
      byId.get(a.dominio)?.tipo !== 'dominio' || byId.has(a.id) || !a.nombre || !a.etiqueta ||
      !a.asignaciones?.length || a.asignaciones.some(x => byId.get(x.dominio)?.tipo !== 'dominio' || !sourceIds.has(x.fuente)) ||
      !a.evidencias.length || a.evidencias.some(e => !sourceIds.has(e.fuente)))) {
      throw new Error('La selección contiene actores, dominios o fuentes inválidos.');
    }
    state.sources = selection.fuentes;
    state.actors = selection.actores.sort((a,b) => {
      const priority = r => r.tipo === 'Ministerio' ? 0 : r.tipo === 'Instrumento curricular' ? 1 : r.tipo === 'Área curricular' ? 2 : 3;
      return priority(a)-priority(b) || a.nombre.localeCompare(b.nombre,'es');
    });
    if (state.actors.some(a => a.vinculos.some(v => !actorIds.has(v.destino) || !sourceIds.has(v.fuente)))) {
      throw new Error('Un vínculo del catálogo apunta a una entidad o fuente inexistente.');
    }
    state.links = links.map(link => {
      if (!byId.has(link.origen) || !byId.has(link.destino)) throw new Error('Una relación apunta a un nodo inexistente.');
      return { ...link, source:byId.get(link.origen), target:byId.get(link.destino) };
    });
    positionNodes();
  }

  function positionNodes() {
    const domains = state.nodes.filter(n => n.tipo === 'dominio');
    state.nodes.forEach(node => {
      const angle = domains.indexOf(node) * Math.PI * 2 / domains.length - Math.PI / 2;
      node.x = node.tipo === 'centro' ? 0 : Math.cos(angle)*CONFIG.radius;
      node.y = node.tipo === 'centro' ? 0 : Math.sin(angle)*CONFIG.radius;
    });
  }

  // Líneas de texto cortas sin foreignObject para mantener SVG portable.
  function wrapLabel(selection, maxLength) {
    selection.each(function(node) {
      const lines = [];
      (node.etiqueta || node.nombre).split(/\s+/).forEach(word => {
        if (!lines.length || (lines[lines.length-1]+' '+word).length > maxLength) lines.push(word);
        else lines[lines.length-1] += ' '+word;
      });
      const central = node.tipo === 'centro' || node.id === state.expanded;
      d3.select(this).selectAll('tspan').data(lines).join('tspan')
        .attr('x',0).attr('y',(_,i) => central ? (i-(lines.length-1)/2)*21+5 : 51+i*19)
        .text(line => line);
    });
  }

  function selectNode(node) {
    state.selected = node.id;
    element('panel-kind').textContent = node.tipo === 'centro' ? 'CONCEPTO CENTRAL' : `DOMINIO ${String(node.orden).padStart(2,'0')}`;
    element('panel-title').textContent = node.nombre;
    element('panel-description').textContent = node.descripcion;
    nodeSelection.classed('selected',d => d.id === node.id).attr('aria-pressed',d => String(d.id === node.id));
    linkSelection.classed('active',d => d.source.id === node.id || d.target.id === node.id);
    d3.selectAll('.domain-button').attr('aria-pressed',d => String(d.id === node.id));
    setExpanded(node.tipo === 'dominio' ? node.id : null);
    element('estado').textContent = `Seleccionado: ${node.nombre}. Información en el panel de detalles.`;
    element('estado').className = 'sr-only';
    document.querySelector('.panel').scrollTop = 0;
  }

  // La frecuencia se calcula por trabajo, no por página ni formato del archivo.
  function sourceGroups(actor) {
    return new Set(actor.evidencias.map(e => state.sources.find(s => s.id === e.fuente)).filter(s => s.clase === 'mapa').map(s => s.grupo)).size;
  }

  function selectActor(actor) {
    state.actorSelected = actor.id;
    renderBreadcrumb();
    element('actor-detail').hidden = false;
    element('actor-type').textContent = actor.tipo;
    element('actor-title').textContent = actor.nombre;
    element('actor-description').textContent = actor.descripcion;
    element('actor-note').textContent = actor.nota;
    element('actor-note').hidden = !actor.nota;
    const officialCount = new Set(actor.evidencias.filter(e => state.sources.find(s => s.id === e.fuente).clase === 'oficial').map(e => e.fuente)).size;
    element('actor-frequency').textContent = `${sourceGroups(actor)} mapas citados${officialCount ? ` · ${officialCount} fuentes oficiales consultadas` : ''}. Consulta el origen y el apartado de cada mención.`;
    const assignments = [...new Map(actor.asignaciones.map(a => [a.dominio+'|'+a.subdominio,a])).values()];
    d3.select('#actor-domains').selectAll('button').data(assignments).join('button')
      .attr('class','domain-chip').attr('type','button')
      .text(a => `${state.nodes.find(n => n.id === a.dominio).nombre} · ${a.subdominio}`)
      .on('click',(_,a) => {
        setExpanded(a.dominio); openSubdomain(a.subdominio); locateActor(actor);
      });
    d3.select('#actor-relations').selectAll('button').data(actor.vinculos).join('button')
      .attr('class','domain-chip').attr('type','button')
      .text(v => `${v.tipo}: ${state.actors.find(a => a.id === v.destino).nombre}`)
      .on('click',(_,v) => {
        const related = state.actors.find(a => a.id === v.destino);
        setExpanded(related.dominio); openSubdomain(related.asignaciones.find(a => a.dominio === related.dominio).subdominio); locateActor(related);
      });
    const items = d3.select('#actor-sources').selectAll('li').data(actor.evidencias).join('li');
    items.selectAll('*').remove();
    items.each(function(e) {
      const source = state.sources.find(s => s.id === e.fuente);
      const url = source.url || `${encodeURI(source.ruta)}${source.archivo?.endsWith('.pdf') && e.paginas.length ? '#page='+e.paginas[0] : ''}`;
      const label = `${source.nombre}${e.paginas.length ? ` · ${source.archivo?.endsWith('.pptx') ? 'diap.' : 'pág.'} ${e.paginas.join(', ')}` : ''}`;
      d3.select(this).append('a').attr('href',url).attr('target','_blank').attr('rel','noopener').text(label);
      d3.select(this).append('span').text(` — ${e.seccion || ''}${e.mencion ? `: ${e.mencion}` : ''}`);
    });
    actorSelection.classed('selected',a => a.id === actor.id).attr('aria-pressed',a => String(a.id === actor.id));
    d3.selectAll('.actor-button').attr('aria-pressed',a => String(a.id === actor.id));
    element('estado').textContent = `Ficha de ${actor.nombre} abierta en el panel.`;
    element('actor-detail').scrollIntoView({block:'nearest'});
  }

  function filteredActors() {
    return Catalogo.filter(state.actors,{domain:state.expanded === 'all' ? null : state.expanded,
      subdomain:state.subdomain,type:state.type,query:state.query});
  }

  function locateActor(actor) {
    const matches = filteredActors();
    state.page = Math.max(0,Math.floor(matches.findIndex(a => a.id === actor.id)/8));
    drawActors(); selectActor(actor);
  }

  function setExpanded(domainId,{preserveQuery=false}={}) {
    state.expanded=domainId; state.actorSelected=null; state.page=0;
    state.subdomain=''; state.type=''; state.activeSubdomain=null;
    if (!preserveQuery) { state.query=''; element('actor-search').value=''; }
    element('type-filter').value='';
    element('actor-detail').hidden=true;
    element('actor-section').hidden=!domainId;
    nodeSelection.attr('aria-expanded',d => d.tipo === 'dominio' ? String(d.id === domainId) : null);
    d3.selectAll('.domain-button').attr('aria-expanded',d => String(d.id === domainId));
    if (domainId === 'all') {
      element('panel-kind').textContent='CATÁLOGO COMPLETO';
      element('panel-title').textContent='Actores e instrumentos';
      element('panel-description').textContent='Busca por nombre o función. Los filtros incluyen todos los registros del catálogo.';
    } else if (domainId) {
      const domain=state.nodes.find(n => n.id === domainId);
      element('panel-kind').textContent=`DOMINIO ${String(domain.orden).padStart(2,'0')}`;
      element('panel-title').textContent=domain.nombre;
      element('panel-description').textContent=domain.descripcion;
    }
    state.selected=domainId || 'ecosistema';
    nodeSelection.classed('selected',d => d.id === state.selected).attr('aria-pressed',d => String(d.id === state.selected));
    d3.selectAll('.domain-button').attr('aria-pressed',d => String(d.id === state.selected));
    linkSelection.classed('active',d => d.source.id === state.selected || d.target.id === state.selected);
    const scope = Catalogo.filter(state.actors,{domain:domainId === 'all' ? null : domainId});
    const subdomains = [...new Set(scope.flatMap(a => a.asignaciones.filter(x => domainId === 'all' || x.dominio === domainId).map(x => x.subdominio)))].sort((a,b) => a.localeCompare(b,'es'));
    d3.select('#subdomain-filter').selectAll('option').data(['',...subdomains]).join('option').attr('value',d => d).text(d => d || 'Todos los subdominios');
    element('subdomain-filter').value='';
    drawScene();
  }

  function renderBreadcrumb() {
    const root = state.nodes.find(n => n.tipo === 'centro');
    const domain = state.nodes.find(n => n.id === state.expanded);
    const route = [{label:'Ecosistema',action:() => selectNode(root)}];
    if (state.expanded === 'all') route.push({label:'Catálogo',action:() => setExpanded('all')});
    if (domain) route.push({label:domain.nombre,action:() => setExpanded(domain.id)});
    if (domain && state.subdomain) route.push({label:state.subdomain,action:() => openSubdomain(state.subdomain)});
    if (state.actorSelected) route.push({label:state.actors.find(a => a.id === state.actorSelected).nombre});
    d3.select('#breadcrumb').selectAll('button').data(route).join('button')
      .attr('type','button').attr('aria-current',(_,i) => i === route.length-1 ? 'location' : null)
      .text(r => r.label).on('click',(_,r) => r.action?.());
  }

  function openSubdomain(name) {
    if (!name) { setExpanded(state.expanded); return; }
    const groups = Catalogo.subdomains(state.actors,state.expanded);
    const index = groups.findIndex(g => g.nombre === name);
    if (index < 0) return;
    // Conserva el lugar que ocupaba la categoría en su página radial.
    const domain = state.nodes.find(n => n.id === state.expanded);
    const points = Catalogo.domainPositions(groups.slice(Math.floor(index/8)*8,Math.floor(index/8)*8+8),domain);
    state.activeSubdomain = {...points[index%8],color:domain.color};
    state.subdomain=name; state.page=0; state.type='';
    element('type-filter').value=''; element('subdomain-filter').value=name;
    drawScene();
  }

  function drawScene() {
    state.actorSelected=null;
    element('actor-detail').hidden=true;
    state.visibleSubdomains=[]; state.visibleActors=[];
    actorLayer.selectAll('*').remove(); actorLinks.selectAll('*').remove();
    subdomainLayer.selectAll('*').remove(); subdomainLinks.selectAll('*').remove();
    const domain = state.nodes.find(n => n.id === state.expanded);
    const categories = !!domain && !state.subdomain;
    // En el detalle, la cámara muestra una rama; las coordenadas base no cambian.
    nodeSelection.attr('display',d => domain && d.id !== domain.id ? 'none' : null)
      .classed('focused-domain',d => d.id === domain?.id);
    nodeSelection.select('.disc').attr('r',d => d.tipo === 'centro' ? CONFIG.centerRadius : d.id === domain?.id ? 100 : CONFIG.nodeRadius);
    nodeSelection.select('.halo').attr('r',d => d.tipo === 'centro' ? CONFIG.centerRadius+10 : d.id === domain?.id ? 110 : CONFIG.nodeRadius+8);
    nodeSelection.select('.node-number').attr('display',d => d.id === domain?.id ? 'none' : null);
    nodeSelection.select('.node-label').each(function(d) {wrapLabel(d3.select(this),d.tipo === 'centro' || d.id === domain?.id ? 19 : 24);});
    linkSelection.attr('display',domain ? 'none' : null);
    world.select('.orbit').attr('display',domain ? 'none' : null);
    element('catalog-filters').hidden=categories;
    element('actor-list-title').textContent=categories ? 'SUBDOMINIOS · ELIGE UNA CATEGORÍA' : state.subdomain || 'ACTORES E INSTRUMENTOS';
    if (domain) {
      const groups=Catalogo.subdomains(state.actors,domain.id);
      const page=Catalogo.paginate(groups,state.page,8);
      if (categories) {
        state.page=page.page;
        state.visibleSubdomains=Catalogo.domainPositions(page.items,domain).map(g => ({...g,color:domain.color}));
        element('catalog-results').textContent=`${groups.length} subdominios · ${Catalogo.filter(state.actors,{domain:domain.id}).length} registros únicos. Una entidad puede aparecer en varias categorías.`;
        element('page-label').textContent=`${page.page+1} / ${page.pages}`;
        element('previous-page').disabled=page.page===0;
        element('next-page').disabled=page.page+1===page.pages;
        element('map-context').textContent='Selecciona un subdominio para desplegar sus actores e instrumentos.';
        const buttons=d3.select('#actor-list').selectAll('button').data(page.items,g => g.id).join('button')
          .attr('class','actor-button subdomain-button').attr('type','button').attr('aria-pressed',null)
          .on('click',(_,g) => openSubdomain(g.nombre));
        buttons.selectAll('*').remove();
        buttons.append('span').text(g => g.nombre);
        buttons.append('small').text(g => `${g.count} ${g.count === 1 ? 'registro' : 'registros'} · Explorar →`);
      } else state.visibleSubdomains=[state.activeSubdomain];
      subdomainLinks.selectAll('line').data(state.visibleSubdomains).join('line').attr('class','subdomain-link');
      subdomainSelection=subdomainLayer.selectAll('g').data(state.visibleSubdomains).join('g')
        .attr('class','node subdomain-node').attr('style',g => `--node-color:${g.color}`)
        .attr('tabindex',0).attr('role','button').attr('aria-label',g => `${g.nombre}: ${g.count} ${g.count === 1 ? 'registro' : 'registros'}. Explorar`)
        .attr('aria-expanded',String(!categories))
        .on('click',(_,g) => openSubdomain(g.nombre))
        .on('keydown',(event,g) => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();openSubdomain(g.nombre);}});
      subdomainSelection.append('title').text(g => `${g.nombre} · ${g.count} ${g.count === 1 ? 'registro' : 'registros'}`);
      subdomainSelection.append('circle').attr('class','halo').attr('r',42);
      subdomainSelection.append('circle').attr('class','disc').attr('r',34);
      subdomainSelection.append('text').attr('class','node-number').attr('y',-7).text(g => g.count);
      subdomainSelection.append('text').attr('class','count-caption').attr('y',13).text(g => g.count === 1 ? 'registro' : 'registros');
      subdomainSelection.append('text').attr('class','node-label').call(wrapLabel,24);
      subdomainSelection.call(d3.drag().container(() => world.node()).clickDistance(4).on('drag',(event,g) => {
        if (state.activeSubdomain === g) state.visibleActors.forEach(a => {a.x+=event.x-g.x;a.y+=event.y-g.y;});
        g.x=event.x;g.y=event.y;updateGeometry();
      }));
    }
    if (!categories) drawActors();
    else {updateGeometry();fitMap();}
    element('estado').textContent=element('map-context').textContent;
    renderBreadcrumb();
  }

  function drawActors() {
    state.actorSelected=null;
    element('actor-detail').hidden=true;
    actorLayer.selectAll('*').remove(); actorLinks.selectAll('*').remove();
    state.visibleActors=[];
    if (!state.expanded) {
      element('map-context').textContent='Ocho dominios. Un entorno compartido.';
      svg.call(zoom.transform,d3.zoomIdentity); return;
    }
    const matches=filteredActors();
    const page=Catalogo.paginate(matches,state.page,8); state.page=page.page;
    const domain=state.nodes.find(n => n.id === state.expanded);
    const angle=domain ? Math.atan2(domain.y,domain.x) : -Math.PI/2;
    const points=state.activeSubdomain ? Catalogo.branchPositions(page.items,state.activeSubdomain,domain) : Catalogo.positions(page.items,angle);
    state.visibleActors=points.map(actor => {
      const origin=domain || state.nodes.find(n => n.id === actor.dominio);
      return {...actor,color:origin.color,origin:origin.id};
    });
    element('catalog-results').textContent=page.total ? `${page.total} ${page.total === 1 ? 'registro coincide' : 'registros coinciden'}. Mostrando ${page.page*8+1}–${page.page*8+page.items.length}.` : 'No hay resultados. Prueba otro nombre o cambia los filtros.';
    element('page-label').textContent=`${page.page+1} / ${page.pages}`;
    element('previous-page').disabled=page.page===0;
    element('next-page').disabled=page.page+1===page.pages;
    element('map-context').textContent=`${page.items.length} de ${page.total} registros · usa Anterior / Siguiente en el panel`;
    actorLinks.selectAll('line').data(state.visibleActors).join('line').attr('class','actor-link');
    actorSelection=actorLayer.selectAll('g').data(state.visibleActors).join('g')
      .attr('class','node actor-node').attr('style',a => `--node-color:${a.color}`)
      .attr('tabindex',0).attr('role','button').attr('aria-pressed','false')
      .attr('aria-label',a => `Ver ficha: ${a.nombre}`)
      .on('click',(_,a) => selectActor(a))
      .on('keydown',(event,a) => {
        if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();selectActor(a);}
      });
    actorSelection.append('title').text(a => `${a.nombre} · ${a.tipo}`);
    actorSelection.append('circle').attr('class','halo').attr('r',28);
    actorSelection.filter(a => a.naturaleza !== 'instrumento' && a.naturaleza !== 'unidad').append('circle').attr('class','disc').attr('r',20);
    actorSelection.filter(a => a.naturaleza === 'instrumento').append('path').attr('class','instrument-shape').attr('d','M0,-24L24,0L0,24L-24,0Z');
    actorSelection.filter(a => a.naturaleza === 'unidad').append('rect').attr('class','unit-shape').attr('x',-20).attr('y',-20).attr('width',40).attr('height',40).attr('rx',5);
    actorSelection.append('text').attr('class','node-number').text((_,i) => String(page.page*8+i+1));
    actorSelection.append('text').attr('class','node-label').call(wrapLabel,22);
    actorSelection.call(d3.drag().container(() => world.node()).clickDistance(4)
      .on('drag',(event,a) => {a.x=event.x;a.y=event.y;updateGeometry();}));
    const buttons=d3.select('#actor-list').selectAll('button').data(page.items,a => a.id).join('button')
      .attr('class','actor-button').attr('type','button').attr('aria-pressed','false').on('click',(_,a) => selectActor(a));
    buttons.selectAll('*').remove();
    buttons.append('span').text(a => a.nombre);
    buttons.append('small').text(a => `${a.tipo} · ${a.dominios.length} ${a.dominios.length === 1 ? 'dominio' : 'dominios'}`);
    updateGeometry();fitMap();renderBreadcrumb();
  }

  function fitMap() {
    // Ajusta la cámara sin modificar posiciones del centro ni de los dominios.
    const base = state.expanded && state.expanded !== 'all' ? state.nodes.filter(n => n.id === state.expanded) : state.nodes;
    const visible = [...base,...state.visibleSubdomains,...state.visibleActors];
    const x0 = d3.min(visible,d => d.x)-140, x1 = d3.max(visible,d => d.x)+140;
    const y0 = d3.min(visible,d => d.y)-100, y1 = d3.max(visible,d => d.y)+150;
    const scale = Math.min(1,(CONFIG.width-50)/(x1-x0),(CONFIG.height-150)/(y1-y0));
    const cx = (x0+x1)/2+CONFIG.width/2, cy = (y0+y1)/2+CONFIG.height/2;
    svg.call(zoom.transform,d3.zoomIdentity.translate(CONFIG.width/2-scale*cx,CONFIG.height/2-scale*cy).scale(scale));
  }

  function updateGeometry() {
    nodeSelection.attr('transform',d => `translate(${d.x},${d.y})`);
    linkSelection.attr('x1',d => d.source.x).attr('y1',d => d.source.y)
      .attr('x2',d => d.target.x).attr('y2',d => d.target.y);
    if (state.expanded) {
      subdomainSelection?.attr('transform',d => `translate(${d.x},${d.y})`);
      const domain=state.nodes.find(n => n.id === state.expanded);
      // Las líneas terminan en los bordes de los círculos, sin atravesarlos.
      subdomainLinks.selectAll('line').each(function(d) {
        const dx=d.x-domain.x,dy=d.y-domain.y,length=Math.hypot(dx,dy)||1;
        d3.select(this).attr('x1',domain.x+dx/length*110).attr('y1',domain.y+dy/length*110)
          .attr('x2',d.x-dx/length*42).attr('y2',d.y-dy/length*42);
      });
      actorSelection?.attr('transform',d => `translate(${d.x},${d.y})`);
      actorLinks.selectAll('line').each(function(d) {
        const origin=state.activeSubdomain || state.nodes.find(n => n.id === d.origin);
        const dx=d.x-origin.x,dy=d.y-origin.y,length=Math.hypot(dx,dy)||1;
        const radius=state.activeSubdomain ? 42 : 34;
        d3.select(this).attr('x1',origin.x+dx/length*radius).attr('y1',origin.y+dy/length*radius)
          .attr('x2',d.x-dx/length*28).attr('y2',d.y-dy/length*28);
      });
    }
  }

  function render() {
    svg = d3.select('#mapa').attr('viewBox',`0 0 ${CONFIG.width} ${CONFIG.height}`);
    const viewport = svg.append('g');
    world = viewport.append('g').attr('transform',`translate(${CONFIG.width/2},${CONFIG.height/2})`);
    world.append('circle').attr('class','orbit').attr('r',CONFIG.radius);
    linkSelection = world.append('g').attr('aria-hidden','true').selectAll('line').data(state.links).join('line').attr('class','link');
    actorLinks = world.append('g').attr('aria-hidden','true');
    subdomainLinks = world.append('g').attr('aria-hidden','true');
    nodeSelection = world.append('g').selectAll('g').data(state.nodes).join('g')
      .attr('class',d => `node${d.tipo === 'centro' ? ' central' : ''}`)
      .attr('style',d => `--node-color:${d.color}`).attr('tabindex',0).attr('role','button')
      .attr('aria-label',d => `Ver información: ${d.nombre}`).attr('aria-pressed','false')
      .on('click',(_,d) => selectNode(d))
      .on('keydown',(event,d) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(d); }
      })
      .on('mouseenter',(_,d) => linkSelection.classed('active',l => l.target.id === d.id || l.source.id === d.id))
      .on('mouseleave',() => linkSelection.classed('active',l => l.target.id === state.selected || l.source.id === state.selected));
    nodeSelection.append('title').text(d => `${d.nombre} — clic para consultar${d.tipo === 'dominio' ? '; arrastra para mover' : ''}`);
    nodeSelection.append('circle').attr('class','halo').attr('r',d => d.tipo === 'centro' ? CONFIG.centerRadius+10 : CONFIG.nodeRadius+8);
    nodeSelection.append('circle').attr('class','disc').attr('r',d => d.tipo === 'centro' ? CONFIG.centerRadius : CONFIG.nodeRadius);
    nodeSelection.filter(d => d.tipo === 'dominio').append('text').attr('class','node-number').text(d => String(d.orden).padStart(2,'0'));
    nodeSelection.append('text').attr('class','node-label').each(function(d) { wrapLabel(d3.select(this),d.tipo === 'centro' ? 15 : 24); });
    subdomainLayer = world.append('g');
    actorLayer = world.append('g');

    // Las coordenadas del arrastre se calculan dentro del mundo ya transformado.
    nodeSelection.filter(d => d.tipo !== 'centro').call(d3.drag().container(() => world.node()).clickDistance(4)
      .on('start',function() { d3.select(this).classed('dragging',true); })
      .on('drag',(event,d) => {
        if (d.id === state.expanded) [...state.visibleActors,...state.visibleSubdomains].forEach(a => { a.x+=event.x-d.x; a.y+=event.y-d.y; });
        d.x=event.x; d.y=event.y; updateGeometry();
      })
      .on('end',function() { d3.select(this).classed('dragging',false); }));
    zoom = d3.zoom().scaleExtent([0.5,3]).clickDistance(4).on('zoom',event => viewport.attr('transform',event.transform));
    svg.call(zoom).on('dblclick.zoom',null);
    element('zoom-in').onclick = () => svg.call(zoom.scaleBy,1.25);
    element('zoom-out').onclick = () => svg.call(zoom.scaleBy,0.8);
    element('reset').onclick = () => {
      positionNodes();
      selectNode(state.nodes.find(n => n.tipo === 'centro'));
      updateGeometry();
    };
    d3.select('#domain-list').selectAll('button').data(state.nodes.filter(d => d.tipo === 'dominio')).join('button')
      .attr('class','domain-button').attr('type','button').attr('aria-pressed','false')
      .style('--domain-color',d => d.color).on('click',(_,d) => selectNode(d))
      .each(function(d) {
        d3.select(this).append('span').attr('class','domain-index').text(String(d.orden).padStart(2,'0'));
        d3.select(this).append('span').text(`${d.nombre} (${Catalogo.filter(state.actors,{domain:d.id}).length})`);
      });
    updateGeometry();
    element('actor-total').textContent = `${state.actors.length} registros · ${state.actors.filter(a => a.naturaleza === 'actor').length} actores`;
    element('show-all').disabled=false;
    element('show-all').onclick=() => setExpanded('all');
    element('actor-search').oninput=event => {state.query=event.target.value;setExpanded('all',{preserveQuery:true});};
    element('subdomain-filter').onchange=event => {
      if (state.expanded !== 'all') openSubdomain(event.target.value);
      else {state.subdomain=event.target.value;state.page=0;drawScene();}
    };
    element('type-filter').onchange=event => {state.type=event.target.value;state.page=0;drawScene();};
    element('previous-page').onclick=() => {state.page--;drawScene();};
    element('next-page').onclick=() => {state.page++;drawScene();};
    renderBreadcrumb();
    document.querySelectorAll('.controls button').forEach(button => { button.disabled=false; });
  }

  async function init() {
    try {
      if (!window.d3) throw new Error('No se pudo cargar D3. Comprueba tu conexión a Internet y recarga.');
      await loadData();
      render();
      element('estado').textContent = 'Mapa cargado: ocho dominios disponibles.';
      element('estado').className = 'sr-only';
    } catch (error) {
      element('estado').className = 'error';
      element('estado').textContent = `No se pudo iniciar el mapa. ${error.message} Ejecuta el proyecto mediante un servidor HTTP local (consulta README.md).`;
      console.error(error);
    }
  }
  init();
})();
