"""Valida integridad, cobertura y fuentes del catálogo sin dependencias externas."""
import csv,json
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]
d=json.loads((ROOT/'data/seleccion-actores.json').read_text())
with (ROOT/'data/actores.csv').open() as f: concepts=list(csv.DictReader(f))
ids={a['id'] for a in d['actores']};domains={a['id'] for a in concepts if a['tipo']=='dominio'}
source_ids={s['id'] for s in d['fuentes']}
assert len(ids)==len(d['actores'])
assert len(domains)==8
assert len(source_ids)==len(d['fuentes'])
assert len(d['cobertura_base'])==355
assert all(c['id'] in ids and c['dominio'] in domains for c in d['cobertura_base'])
for s in d['fuentes']:
 if s['clase']=='mapa': assert (ROOT/s['ruta']).is_file(),s
 else: assert s['url'].startswith('https://'),s
for a in d['actores']:
 assert a['evidencias'] and a['asignaciones'] and a['descripcion']
 assert set(a['dominios'])=={v['dominio'] for v in a['asignaciones']}
 assert all(e['fuente'] in source_ids for e in a['evidencias'])
 assert all(e['fuente'] in source_ids and e['dominio'] in domains for e in a['asignaciones'])
 assert all(v['destino'] in ids and v['fuente'] in source_ids for v in a['vinculos'])
 assert a['naturaleza'] in ['actor','unidad','iniciativa','instrumento','agrupacion']
lookup={a['id']:a for a in d['actores']}
for c in d['cobertura_base']:
 a=lookup[c['id']]
 assert any(e['fuente']=='BASE' and e['mencion']==c['entrada'] and e['seccion']==c['subdominio'] for e in a['evidencias']),c
 assert any(e['fuente']=='BASE' and e['dominio']==c['dominio'] and e['subdominio']==c['subdominio'] for e in a['asignaciones']),c
ministries=[a for a in d['actores'] if a['tipo']=='Ministerio']
assert len(ministries)==7
assert all('politica' in a['dominios'] for a in ministries)
cnb=next(a for a in d['actores'] if a['nombre']=='Currículum Nacional Base (CNB)')
assert cnb['naturaleza']=='instrumento'
assert set(cnb['dominios'])=={'educacion','politica','talento'}
assert any('MINEDUC' in lookup[v['destino']]['nombre'] for v in cnb['vinculos'])
print('Integridad correcta:',len(ids),'registros, 355 entradas base trazables, 7 ministerios y CNB vinculado.')
print('Naturalezas:',dict(Counter(a['naturaleza'] for a in d['actores'])))
