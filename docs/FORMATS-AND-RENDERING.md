# Planos, modelos y recorrido en Atlas

## Qué pedir cuando te entregan un diseño

Pide el archivo editable, un PDF de las láminas y sus referencias externas. Comprueba las unidades, la escala de impresión y una distancia conocida. Un plano escaneado no tiene necesariamente una escala uniforme; un modelo convertido a malla pierde información BIM.

| Familia | Archivos habituales | Soporte de Atlas |
| --- | --- | --- |
| CAD editable | DWG, DXF, DGN | DXF **ASCII**, con las entidades admitidas por el importador, a muros o volúmenes. DWG/DGN necesitan exportación previa a DXF. |
| Entrega e impresión | PDF, SVG | PDF: primera página como referencia o silueta. SVG: contornos. Entrega de Atlas: PDF a escala, planta SVG y DXF. |
| BIM | IFC; Revit RVT/RFA; Archicad PLN/PLA | Sin importación BIM nativa. Pedir DXF de las plantas o GLB/OBJ para visualizar geometría. No se conserva la semántica BIM al convertir a malla. |
| Modelado/visualización | SKP, 3DM, FBX, GLB/glTF, OBJ, STL, PLY | GLB/glTF, OBJ sin MTL, STL y PLY. glTF necesita sus BIN y texturas. Los otros requieren conversión. No se admiten todas las extensiones de compresión o animación. |
| Escaneos | PNG, JPEG, WebP, BMP, GIF, AVIF, TIFF | Todos los indicados excepto TIFF; convertirlo a PNG. Referencia calibrada o silueta extruida. |
| Lote/relieve | GeoJSON, ASC, XYZ/CSV, HGT, GeoTIFF, LAS/LAZ | Panel Terreno: GeoJSON para contornos, ASC/XYZ/CSV/HGT para alturas. GeoTIFF y LAS/LAZ requieren conversión. |
| Proyecto propio | .auralis-atlas | Conserva plantas, medidas, modelos, fuentes de luz y estados de interacción. Las exportaciones PDF/PNG/DXF no sustituyen el proyecto editable. |

La misma guía está disponible dentro de **Importar**. Fuentes primarias: [Autodesk: DWG](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/AutoCAD-drawing-file-format.html), [Revit](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Standards-and-file-formats-supported-by-Revit.html), [Graphisoft: Archicad](https://community.graphisoft.com/t5/Base-de-connaissances/Formats-de-fichiers-Import-Export-dans-Archicad/ta-p/671052), [buildingSMART: IFC](https://technical.buildingsmart.org/standards/IFC/), [Khronos: glTF](https://www.khronos.org/gltf/).

## Construcción y acabados

Las paredes y habitaciones muestran un volumen transparente durante el trazado 3D, con altura y espesor. El plano muestra su huella. Al soltar se confirma la construcción.

En **Acabados**, selecciona **Suelo de habitación** o **Paredes**, después una muestra. El suelo puede pintarse pulsando sobre un mueble: el pincel usa la habitación situada debajo. El resaltado indica el suelo que recibirá el acabado. **Aplicar a selección** permite pintar una habitación ya seleccionada. En paredes generadas por una habitación, el acabado se aplica a su perímetro; una pared independiente se pinta de forma individual. Un aviso confirma el cambio y Ctrl+Z lo deshace.

Al arrastrar muebles, el ajuste parte del punto donde los sujetaste para evitar saltos. **Mayús** limita el desplazamiento a un eje, **Alt** libera la cuadrícula y **Esc** cancela sin guardar la posición provisional. **Superponer** también está disponible al mover una selección.

## Recorrido e interacciones

Apunta con la cruz a un objeto situado a menos de 2,8 m. La acción aparece junto al botón **E**; puedes pulsar la tecla o el botón en pantalla.

- Puertas y ventanas: abrir/cerrar. Una puerta cerrada impide atravesar su hueco. Las puertas de proyectos antiguos conservan el estado abierto que tenían visualmente; las nuevas empiezan cerradas.
- Lámparas y fuentes de luz: encender/apagar. Las lámparas del catálogo generan su propia luz; no hace falta colocar una segunda fuente. La lámpara de mesa usa inicialmente 220 lm y un alcance de 2 m. Potencia y alcance se cambian en Propiedades.
- Televisores y pantallas: cambiar entre pantalla apagada e iluminada. Esta revisión no reproduce canales, vídeo ni audio.
- Almacenamiento y electrodomésticos con puerta: abrir/cerrar sus partes móviles. No simula procesos de lavado, cocción ni consumo eléctrico.
- Camas y asientos: acostarse/sentarse y levantarse con E. Caminar también devuelve al punto de pie anterior.
- Otros aparatos: cambiar su estado visual cuando existe una función implementada. Objetos pasivos o importados: examinar nombre y medidas. Un modelo importado no adquiere automáticamente bisagras ni mecanismos.

Los estados de apertura y encendido se guardan. La postura del visitante es temporal. El movimiento tiene aceleración suave, altura de ojos y campo de visión ajustable entre 45° y 90°. No hay simulación completa de física ni escaleras transitables.

La cámara hace una transición gradual al entrar o salir del recorrido, centrar el proyecto, sentarse, acostarse y levantarse. Puertas, ventanas, armarios, electrodomésticos y cortinas recorren posiciones intermedias; las lámparas y pantallas encienden y apagan progresivamente. La vista orbital conserva una inercia breve al soltar el ratón. Se respeta la preferencia del sistema de reducir movimiento.

Solo se separan temporalmente de las instancias hasta ocho muebles que estén animándose. Al terminar, vuelven al conjunto compartido. En edición, el bucle de animación se detiene cuando no queda movimiento. Las imágenes exportadas usan el estado final de las acciones.

## Luz, materiales y render

Los materiales instanciados conservan la rugosidad y metalicidad de cada parte, junto con una variación superficial filtrada para evitar parpadeo a distancia. Se reutilizan geometrías y plantillas entre objetos iguales y sus estados.

Las luces puntuales y focos conservan decaimiento inverso al cuadrado. El alcance finito es un corte suave de la vista rápida, útil para controlar influencia y coste; no equivale a una propiedad física exacta de una bombilla. El ambiente nocturno parte de luz solar cero y ambiente tenue. Ocho fuentes cercanas como máximo se activan a la vez; Equilibrado reserva una sombra local y Detalle dos. Eco y los paneles de área no calculan esas sombras en la vista rápida. Con varias fuentes sin sombras puede existir filtración entre habitaciones: utiliza el render físico para comprobar su oclusión.

**Renderizar → Físico** usa un motor real de trazado de caminos sobre WebGL2: intersecciones aceleradas por BVH, cuatro rebotes, materiales físicos, reflejos y sombras. Acumula de 8 a 128 muestras; pocas muestras dejan grano. Puede cancelarse y libera sus recursos al terminar. Funciona bajo demanda y no sustituye el motor del recorrido. La primera compilación puede tardar considerablemente según el controlador gráfico.

Límites de esta revisión: Full HD, 1200000 triángulos visibles, texturas del trazador de 256 px y cuatro minutos de cálculo de muestras. Las instancias de la vista rápida se expanden únicamente para esa imagen fija. Se conserva la vista y el nivel de detalle visibles. Los límites reducen memoria; **no garantizan un techo universal de 3,5 GB**, especialmente al compilar el trazador en diferentes controladores. El rendimiento del recorrido se mide por separado. El presupuesto solicitado es ahora de 3,5 GB. Se reutiliza el contexto gráfico del editor durante el render y se evita mantener un segundo contexto activo.

Motor: [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer), WebGL compatible 0.0.27, y three-mesh-bvh 0.9.15, MIT. Se distribuye localmente como un módulo opcional de unos 210 kB sin compresión; no descarga código en ejecución. La API WebGL está obsoleta en la biblioteca upstream, pero se fija esta versión compatible con el renderizador actual. Migrar el recorrido completo a WebGPU requiere una revisión independiente.

Documentación: [Three.js PointLight](https://threejs.org/docs/pages/PointLight.html), [implementación del trazador](https://github.com/gkjohnson/three-gpu-pathtracer). Para regenerar el archivo distribuido: `cd tools/pathtracer`, `npm ci --ignore-scripts`, `node build.mjs`. El lockfile y las licencias están incluidos.
