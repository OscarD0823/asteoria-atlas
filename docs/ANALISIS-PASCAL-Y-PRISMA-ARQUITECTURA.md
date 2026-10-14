# Pascal y Prisma Arquitectura

Revisión del 13 de octubre de 2026. Código analizado: [`pascalorg/editor`, commit `85e79e71118fa5302bc4ef89c60bc648453aee4b`](https://github.com/pascalorg/editor/tree/85e79e71118fa5302bc4ef89c60bc648453aee4b). Copia de referencia local: `D:\PDF\Referencias\pascal-editor`. Es un análisis de arquitectura y adaptación de producto, no una auditoría de seguridad.

## Qué ofrece Pascal

Es un editor de edificios cuyo modelo principal es un grafo semántico. Las geometrías y las vistas son representaciones de ese grafo. No es solamente una escena de Three.js con una interfaz encima.

| Componente | Responsabilidad | Referencia |
| --- | --- | --- |
| `core` | Esquemas, grafo, comandos, estado, servicios y operaciones compartidas. Sin Three.js en tiempo de ejecución. | [Decisiones E-001, E-003](https://github.com/pascalorg/editor/blob/85e79e71118fa5302bc4ef89c60bc648453aee4b/DECISIONS.md) |
| `viewer` | Lienzo 3D, cámara, geometrías, materiales y estado de presentación. Independiente del editor. | [Aislamiento del visor](https://github.com/pascalorg/editor/blob/85e79e71118fa5302bc4ef89c60bc648453aee4b/wiki/architecture/viewer-isolation.md) |
| `editor` | Herramientas, plano SVG, selección, propiedades, ajustes, historial y paneles. | [Exportaciones públicas](https://github.com/pascalorg/editor/blob/85e79e71118fa5302bc4ef89c60bc648453aee4b/packages/editor/src/index.tsx) |
| `nodes` | Complemento integrado con definiciones, geometría, renderizadores y capacidades de cada elemento. | [Registro integrado](https://github.com/pascalorg/editor/blob/85e79e71118fa5302bc4ef89c60bc648453aee4b/packages/nodes/src/index.ts) |
| `mcp` y `cli` | Almacenamiento, ejecución local y herramientas para agentes. El servicio local puede conservar proyectos en SQLite. | [README](https://github.com/pascalorg/editor/blob/85e79e71118fa5302bc4ef89c60bc648453aee4b/README.md) |
| `ifc-converter` | Conversión de IFC al modelo Pascal. Algunas entidades siguen siendo mallas importadas, no elementos paramétricos completos. | [Alcance IFC](https://github.com/pascalorg/editor/blob/85e79e71118fa5302bc4ef89c60bc648453aee4b/packages/ifc-converter/README.md) |
| `apps/editor` | Aplicación Next.js que compone los paquetes y el servicio de proyectos. | [Adaptador de almacenamiento](https://github.com/pascalorg/editor/blob/85e79e71118fa5302bc4ef89c60bc648453aee4b/apps/editor/lib/scene-store-server.ts) |

El repositorio usa Bun y Turborepo. El editor depende de Next.js, React, React Three Fiber, Three.js y numerosas bibliotecas de interfaz. Los paquetes publican contratos que permiten componer otra aplicación, pero no forman un componente pequeño independiente de esas dependencias.

La demo alojada **Pascal Next** anuncia una experiencia que el propio README distingue de la versión abierta. No se puede atribuir automáticamente todo lo visible en esa demo al código descargado. Tampoco se debe prometer compatibilidad completa con Revit por disponer de conversión IFC.

El catálogo inspeccionado contiene URLs externas para miniaturas, modelos GLB y planos. La disponibilidad de esos recursos y sus condiciones deben revisarse antes de incorporarlos. La licencia MIT del código exige conservar sus avisos en copias o porciones sustanciales; no demuestra por sí sola la licencia de cualquier modelo remoto. [Licencia del repositorio](https://github.com/pascalorg/editor/blob/85e79e71118fa5302bc4ef89c60bc648453aee4b/LICENSE).

## Decisión para Prisma

La prioridad acordada es **planos, espacios y mobiliario**. Prisma utiliza Vite, páginas estáticas y procesamiento en el dispositivo. Incorporar la aplicación Pascal completa supondría añadir otro entorno de compilación, un servicio de almacenamiento y dependencias ajenas al despliegue actual.

La primera entrega implementa una base propia en `src/architecture`. Toma como referencia la separación del modelo, las vistas y las interacciones. **No es un fork del motor Pascal ni abre su formato de proyecto.** No se copiaron sus modelos, texturas o catálogos. El mobiliario se construye con geometría local de Three.js. El código nuevo sigue la licencia AGPL del repositorio Prisma; las bibliotecas conservan sus propias licencias.

| Idea de Pascal | Implementación inicial en Prisma |
| --- | --- |
| Modelo independiente de la vista | Contrato tipado y validado en `model.ts` |
| Una escena para 2D y 3D | Plano SVG y visor Three.js consumen el mismo proyecto |
| Cambios reversibles | Historial con hasta 80 ediciones; un arrastre produce una edición |
| Estructura a partir de espacios | Rectángulo paramétrico genera suelo y cuatro muros |
| Referencias estables | IDs de muros derivados se mantienen al cambiar un espacio |
| Ajuste visible | Cuadrícula configurable de 1 cm a 1 m y posiciones numéricas |
| Datos del usuario conservados | Biblioteca local, descarga editable y rechazo de archivos incompatibles |

Se mantiene una sola implementación para la entrada de la suite y la aplicación independiente. La entrada de la suite es `?editor=arquitectura`; la entrada independiente de desarrollo es `arquitectura.html`. La fuente canónica está en este repositorio. `scripts/architecture-export.mjs` genera una distribución independiente en [prisma-arquitectura](https://github.com/OscarD0823/prisma-arquitectura), que publica su web con GitHub Pages y sus ejecutables con GitHub Releases.

## Entrega 0.1

- Plantas y elevaciones guardadas; visualización de una planta a la vez.
- Espacios rectangulares con nombre, dimensiones, altura, espesor y color del suelo.
- Muros independientes rectos y muros derivados de espacios. Lados coincidentes completos se deduplican y conservan referencias de ambos sentidos.
- Puertas y ventanas vinculadas a un muro, con validación de dimensiones, posición, altura y solapamiento.
- Diez tipos de mobiliario paramétrico, con arrastre en el plano, giro, duplicación, dimensiones y color.
- Plano 2D, vista 3D y vista conjunta; selección desde ambas vistas y edición por propiedades.
- Muros bajos o completos, navegación orbital y encuadre según la proporción del panel.
- Guardado en el navegador por proyecto, biblioteca, importación y exportación `.prisma-arquitectura` v1.
- SVG de la planta activa, CSV de superficies de todas las plantas e impresión del plano mediante el navegador.
- Un ejemplo de 80 m² con cuatro espacios, ocho aberturas y trece muebles.

La biblioteca depende del origen y del perfil del navegador; no es sincronización entre equipos. Las exportaciones editables son las copias portables. Los errores de cuota o de almacenamiento se muestran y los datos corruptos no se sobrescriben. La aplicación compilada no requiere servicios externos para editar. Esta entrega todavía no incluye un service worker independiente que la instale o garantice su carga sin conexión.

## Entrega 0.2: web y Windows

- Inicio y carga con el logo exacto de Prisma PDF y su estilo visual, biblioteca de proyectos recientes y acceso al ejemplo.
- Edición directa en 3D: agregar espacios, muros, puertas, ventanas, mobiliario y luces, seleccionar y eliminar. Los muebles se arrastran sobre el suelo y disponen de ejes para mover, elevar, girar y escalar; una operación produce una entrada en el historial.
- Posición y dimensiones exactas en m/cm/mm, ajuste configurable de 1 cm a 1 m y regla 2D que responde al zoom. El modelo conserva metros como unidad canónica.
- Mediciones persistidas entre dos puntos 3D, incluyendo diferencias de altura, editables en Propiedades.
- Mobiliario con bordes redondeados y detalles; suelos de madera, baldosa o concreto con textura local.
- Iluminación de día, atardecer o noche, con controles de sol, ambiente, exposición y fondo. Luces puntuales, focos y paneles con posición, altura, color, potencia y objetivo. Hasta 16 por planta; las primeras cuatro fuentes puntuales o focos elegibles pueden proyectar sombras. Los paneles usan luz de área sin sombras.
- Recorrido con WASD/flechas, controles táctiles y arrastre para mirar; altura de ojos y velocidad ajustables. Colisiones básicas contra muros, pasos de puerta y muebles girados/elevados. La cámara vuelve a su posición de edición al salir.
- Render local de la cámara actual en Full HD, QHD o 4K con materiales, sombras y oclusión ambiental; PNG descargable. También captura la cámara interior del recorrido.
- PDF vectorial A3/A4 con escala física 1:20, 1:25, 1:50, 1:75, 1:100 o 1:200. Rechaza planos que no caben conservando la escala; incluye barra de un metro para comprobar la impresión al 100 %.
- Formato v2 con elevación de muebles, iluminación y mediciones. Abre v1 mediante migración validada, conservando geometría, IDs y referencias de aberturas.
- Windows x64: instalador NSIS y ejecutable portátil, editor sin Internet y asociación de `.prisma-arquitectura`. La ventana usa aislamiento de contexto, sandbox, recursos locales y permisos externos denegados. El código fuente y las licencias se incluyen en la distribución.

## Límites actuales y siguiente trabajo

Los espacios son rectangulares. No se detectan habitaciones automáticamente a partir de muros libres. No se fusionan intersecciones o coincidencias parciales entre muros. Las superficies se calculan a partir de las dimensiones del espacio y no descuentan espesores. Las colisiones del recorrido son básicas y no verifican capacidad de paso o cumplimiento normativo. El mobiliario puede superponerse durante la edición. El PDF conserva dimensiones físicas; el usuario debe imprimir al 100 % sin ajustar a la página.

La altura entre plantas está almacenada; no hay visualización apilada, escaleras ni generación automática de estructura entre niveles. El modo de muros bajos es una presentación, no una alteración del modelo guardado.

Las siguientes etapas recomendadas son:

1. Polígonos de espacios y fusión de muros compartidos parciales, con migración del formato y pruebas de áreas y aberturas.
2. Más materiales, bibliotecas de modelos con licencia verificada y herramientas para curvas, techos y escaleras.
3. Láminas con cotas profesionales, vistas apiladas e integración de mediciones con Sheets.
4. Evaluar reutilización de los paquetes Pascal para IFC/BIM o conectores explícitos entre ambos formatos. La conversión necesita un contrato y pruebas propios.
5. Persistencia IndexedDB, instalación web con caché sin conexión y empaquetado Android. Windows ya se distribuye en 0.2.
6. Operaciones públicas para IA/MCP usando el mismo modelo validado y el mismo historial.

La publicación web y los nuevos instaladores son pasos posteriores. Esta entrega se comprueba y se deja lista localmente.

## Ejecución

Desde el repositorio `prisma`, con sus aplicaciones enlazadas y las dependencias instaladas:

```powershell
pnpm dev:architecture
# http://127.0.0.1:4196/arquitectura.html
# Suite en el mismo servidor: http://127.0.0.1:4196/?editor=arquitectura

pnpm test:architecture
pnpm test
pnpm build:architecture
pnpm desktop:architecture
pnpm source:architecture
```

La compilación independiente produce `dist-arquitectura/index.html`, los recursos y los avisos de licencia. Puede servirse desde una carpeta estática; no se debe abrir mediante `file://`. El botón Inicio de Prisma en esta distribución apunta a la página existente de la suite.

Las pruebas específicas cubren el contrato persistido, muros compartidos y orientación de aberturas, dimensiones incompatibles, referencias, deshacer y rehacer, bibliotecas independientes, fallos de guardado y exportación segura de SVG/CSV. Los comandos completos de Prisma verifican el entorno y las pruebas de las aplicaciones existentes.

La entrega 0.1 pasó 14 pruebas específicas y 179 pruebas del entorno completo. La 0.2 pasa 28 pruebas de Arquitectura: migración, transformaciones 3D reversibles, dirección de focos, validación de luz, colisiones, unidades, medidas y escala física del PDF, además de los contratos iniciales. Se comprobó en el contenido vectorial del PDF que la barra de 1 m mide 20 mm a escala 1:50 y que la hoja A3 mide 420 × 297 mm. La suite actual pasó 195 pruebas, incluidas las de Arquitectura; TypeScript y compilaciones independiente e integrada correctas. El entorno compartido puede contener otras mejoras de la suite; Arquitectura conserva sus verificaciones propias en el repositorio independiente.

En navegador se probaron colocación 3D de una silla, movimiento horizontal mediante ejes, elevación de 1 m, cambio a centímetros, eliminación y deshacer; colocación y ajuste de un foco a 900 lm; ambiente nocturno y recorrido interior. Se corrigió y comprobó la exportación con oclusión ambiental. La aplicación empaquetada de Windows inició su canvas 3D sin errores ni avisos, con sus recursos incluidos; el ejecutable portátil finalizó la prueba de inicio con código 0. El instalador y el portátil se generan sin firma digital. Se mantienen registros de comprobación y ejemplos de exportación fuera del repositorio de fuente.
