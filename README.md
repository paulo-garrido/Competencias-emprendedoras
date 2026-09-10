# Ecosistema emprendedor de Guatemala

Aplicación estática en HTML, CSS, JavaScript y D3.js **v7.9.0**, sin frameworks ni compilación. Mapeo ampliado a partir del documento vectorial de Ciudad de Guatemala, los mapas de `fuentes/` y referencias oficiales de ministerios y del Currículum Nacional Base.

## Ejecutar localmente

Desde esta carpeta, con Python 3 instalado:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abre http://127.0.0.1:8000 y detén el servidor con Ctrl+C. No abras `index.html` mediante `file://`: los CSV y el JSON necesitan HTTP. D3 se carga desde jsDelivr y requiere conexión a Internet.

## Datos e interacción

- 8 dominios estables y un centro fijo respecto de la red.
- 370 registros únicos: 177 actores, 28 centros/unidades, 122 programas/eventos, 34 instrumentos/trámites y 9 agrupaciones/referencias compuestas.
- Las 355 entradas del mapa base conservan su evidencia y clasificación original. No equivalen a 355 instituciones distintas.
- 7 ministerios con fuentes oficiales: MINECO, MINEDUC, MINTRAB, MAGA, MINFIN, MARN y MSPAS.
- CNB y dos áreas curriculares con fichas propias, diferenciados de las instituciones y vinculados con MINEDUC.
- Pertenencia a múltiples dominios y subdominios, sin duplicar la ficha.
- Navegación progresiva: ecosistema → dominio → subdominio → ficha. La ruta del panel permite regresar a cualquier nivel. Solo se despliega una rama a la vez.
- Los subdominios se generan de las asignaciones del catálogo, con conteos de registros únicos. Se muestran hasta ocho categorías por página; sus cifras pueden superponerse.
- Al abrir un dominio, sus categorías lo rodean y el ecosistema queda accesible en la ruta del panel. Al abrir una categoría, la cámara se enfoca en esa rama. Sus posiciones y el centro fijo se conservan al regresar.
- Zoom, pan, hover, selección por clic/Enter/Espacio y arrastre de nodos salvo el centro.
- Búsqueda global sin distinción de tildes, filtros por subdominio/tipo y páginas de ocho registros. El catálogo completo es accesible; la paginación solo limita el dibujo y la lista visible.
- Las fichas contienen referencias a documentos locales o sitios oficiales y algunos vínculos institucionales explícitos.
- Restablecer cierra la expansión y recupera la disposición inicial. El arrastre no se guarda entre páginas o recargas.

## Archivos

```text
index.html                     Estructura y carga ordenada de scripts
css/style.css                  Diseño adaptable y estados de interacción
js/catalogo.js                 Funciones puras de búsqueda, filtros y paginación
js/mapa.js                     Carga, validación, D3 y panel de fichas
data/actores.csv               Un centro y ocho conceptos de dominio
data/relaciones.csv            Ocho conexiones conceptuales del centro
data/seleccion-actores.json     Catálogo, asignaciones, fuentes y cobertura
fuentes/                       Mapas originales aportados
SELECCION_ACTORES.md            Metodología, cobertura e inventario
scripts/validar_catalogo.py     Verificación de integridad y trazabilidad
scripts/test_catalogo.cjs       Pruebas de búsqueda y paginación
```

## Metodología integrada

El botón **Metodología** de la cabecera abre `metodologia.html`, con fuentes, criterios, cobertura e inventario desplegable. La página se genera desde `SELECCION_ACTORES.md`: después de editar ese documento, ejecuta `python3 scripts/generar_metodologia.py`.

## Modelo del catálogo

Cada registro tiene `id`, `nombre`, `etiqueta`, `alias`, `tipo`, `naturaleza`, `descripcion`, `nota`, `asignaciones`, `evidencias`, `vinculos`, `dominios` y `dominio` (principal para el dibujo del catálogo global). `palabras_clave` es opcional. Las asignaciones contienen `dominio`, `subdominio` y `fuente`. Las evidencias conservan `fuente`, `paginas`, `mencion` y `seccion`.

Las relaciones de una ficha usan `destino`, `tipo` y `fuente`. No se deben añadir alianzas inferidas únicamente por coaparición. Los CSV originales conservan los conceptos para evitar confundir instituciones con dominios.

## Validación

Con Python 3 y Node.js disponibles:

```sh
python3 scripts/validar_catalogo.py
node scripts/test_catalogo.cjs
node scripts/test_navegacion.cjs
node --check js/mapa.js
```

Las pruebas validan cobertura, identificadores, fuentes y acceso a todos los registros por paginación. No realizan pruebas visuales en navegador.

Para revisar manualmente: abre Política → Incidencia, selecciona una ficha y vuelve mediante la ruta. Recorre la segunda página de subdominios de Apoyo. Luego, busca CNB, entra a su ficha y navega hacia MINEDUC. Filtra Política por Ministerios y confirma siete entradas. Recorre las páginas de Apoyo y prueba una búsqueda sin resultados. Prueba zoom, pan, arrastre y Restablecer, además de una ventana móvil.

## Interpretación

El mapa base tiene alcance de Ciudad de Guatemala. Las ampliaciones nacionales no constituyen un censo territorial de todo el país. Los tipos diferencian actores, unidades, iniciativas e instrumentos; las cifras por dominio se superponen. Las líneas del mapa representan asignación temática, no alianzas verificadas. La documentación explica las decisiones de normalización y los límites de la compilación.

APIs empleadas: [D3 zoom](https://d3js.org/d3-zoom), [D3 drag](https://d3js.org/d3-drag), [D3 fetch](https://d3js.org/d3-fetch).

## Publicar en GitHub Pages

El sitio está preparado para publicarse sin compilación. El archivo `.nojekyll` evita que GitHub procese estos archivos estáticos con Jekyll.

1. Crea o elige el repositorio de destino y sube el contenido de esta carpeta, con `index.html` en su raíz.
2. Incluye `css/`, `js/`, `data/`, `fuentes/`, `metodologia.html`, `SELECCION_ACTORES.md` y `.nojekyll`. Los documentos de `fuentes/` serán accesibles públicamente junto con el sitio.
3. En el repositorio, abre **Settings → Pages**, elige **Deploy from a branch**, la rama que contiene los archivos (normalmente `main`) y **/ (root)**. Guarda.
4. Cuando termine el despliegue, abre el enlace que muestra GitHub Pages y comprueba un dominio, una ficha y la metodología.

Las rutas son relativas y funcionan dentro de la subcarpeta del repositorio. No se requieren contraseñas ni tokens dentro del código. Repositorio: https://github.com/paulo-garrido/Competencias-emprendedoras. GitHub Pages está configurado desde `main`, carpeta raíz. Sitio: https://paulo-garrido.github.io/Competencias-emprendedoras/. Las actualizaciones se publican al subir cambios a `main`.

Referencia: [Crear un sitio de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

La revisión del Word amplía competencias emprendedoras y organiza innovación en tres subdominios; el detalle de decisiones y fuentes está en la metodología. Las categorías originales se conservan en las evidencias.
