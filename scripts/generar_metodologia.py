"""Genera la página estática desde el documento metodológico (sin dependencias)."""
from pathlib import Path
import re
import html
import unicodedata
ROOT = Path(__file__).resolve().parent.parent

def inline(text):
    text=html.escape(text)
    text=re.sub(r'\[([^\]]+)\]\(([^\s]+)\)',r'<a href="\2">\1</a>',text)
    text=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',text)
    return re.sub(r'`([^`]+)`',r'<code>\1</code>',text)

def slug(text):
    return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()).strip('-')

lines=(ROOT/'SELECCION_ACTORES.md').read_text().splitlines()
blocks=[]; toc=[]; i=0; inventory=False
while i<len(lines):
    line=lines[i]
    if not line.strip() or line.startswith('# '): i+=1; continue
    if line.startswith('### '):
        blocks.append('<h3>'+inline(line[4:])+'</h3>');i+=1
    elif line.startswith('## '):
        title=line[3:]; key=slug(title)
        if title=='Inventario de registros':
            blocks.append(f'<details id="{key}"><summary>Consultar el inventario completo de registros</summary>'); inventory=True
        else: blocks.append(f'<h2 id="{key}">{inline(title)}</h2>')
        toc.append(f'<a href="#{key}">{html.escape(title)}</a>');i+=1
    elif line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].startswith('|'):
            cells=[c.strip() for c in lines[i].strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?',c) for c in cells): rows.append(cells)
            i+=1
        blocks.append('<div class="table-scroll" tabindex="0" role="region" aria-label="Tabla de datos"><table><thead><tr>'+''.join('<th scope="col">'+inline(c)+'</th>' for c in rows[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in rows[1:])+'</tbody></table></div>')
    elif line.startswith('- ') or re.match(r'^\d+\. ',line):
        ordered=not line.startswith('- '); tag='ol' if ordered else 'ul'; items=[]
        pattern=r'^\d+\. ' if ordered else r'^- '
        while i<len(lines) and re.match(pattern,lines[i]):
            items.append('<li>'+inline(re.sub(pattern,'',lines[i]))+'</li>');i+=1
        blocks.append('<'+tag+'>'+''.join(items)+'</'+tag+'>')
    else:
        paragraph=[line];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||- |\d+\. )',lines[i]): paragraph.append(lines[i]);i+=1
        blocks.append('<p>'+inline(' '.join(paragraph))+'</p>')
if inventory: blocks.append('</details>')
page='''<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Metodología del inventario · Ecosistema de Guatemala</title><link rel="stylesheet" href="css/style.css"></head>
<body><header class="header"><a class="method-link" href="index.html">← Volver al mapa</a><span class="eyebrow">ATLAS DEL EMPRENDIMIENTO · GUATEMALA</span></header>
<main class="method-page"><div class="method-intro"><p class="eyebrow">FUENTES Y CRITERIOS</p><h1>Metodología del inventario</h1>
<p>Cómo se integraron los mapas, se distinguieron los tipos de registro y se conservaron las fuentes de cada ficha.</p>
<a href="SELECCION_ACTORES.md" download>Descargar documento metodológico</a></div>
<nav class="method-toc" aria-label="Contenido de la metodología">'''+''.join(toc)+'</nav>'+ '\n'.join(blocks)+'</main></body></html>\n'
(ROOT/'metodologia.html').write_text(page)
print('metodologia.html actualizada desde SELECCION_ACTORES.md')
