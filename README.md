# Prisma Arquitectura 0.2.0

[Abrir editor web](https://oscard0823.github.io/prisma-arquitectura/) · [Descargar Windows](https://github.com/OscarD0823/prisma-arquitectura/releases/latest) · [Suite Prisma](https://oscard0823.github.io/prisma/)

Editor de planos, espacios y mobiliario con procesamiento local. Usa el logo y la pantalla de inicio de la familia Prisma PDF.

- Dibuja espacios rectangulares, muros, puertas y ventanas en 2D o 3D.
- Agrega, arrastra, eleva, gira, escala, duplica y elimina muebles directamente en 3D, con historial para deshacer.
- Trabaja en m/cm/mm con ajuste configurable de 1 cm a 1 m y mediciones entre superficies en tres dimensiones.
- Ajusta materiales del suelo, sol, ambiente, exposición y hasta 16 lámparas por planta (puntual, foco o panel). Las primeras cuatro luces puntuales o focos habilitados pueden proyectar sombras; los paneles no.
- Recorre la planta con WASD/flechas y arrastra para mirar. El recorrido aplica colisiones básicas de muros, puertas y muebles.
- Renderiza la cámara actual a Full HD, QHD o 4K, con materiales, sombras y oclusión ambiental; exporta PNG.
- Exporta PDF vectorial A3/A4 a 1:20, 1:25, 1:50, 1:75, 1:100 o 1:200, además de SVG, superficies CSV y el proyecto editable.
- Guarda proyectos en el dispositivo. Importa archivos v1 y los migra a v2 conservando las medidas y las referencias de las aberturas.
- Versión Windows x64 instalable o portátil, con asociación del archivo .prisma-arquitectura y editor completo sin Internet.

## Ejecutar y compilar

Requiere Node.js 22 o posterior.

```sh
npm ci
npm run dev
npm test
npm run build
```

La web compilada está en dist-arquitectura. Para generar Windows, ejecuta npm run desktop:build en Windows. npm run desktop:dev abre el editor después de compilar. El instalador y el ejecutable portátil se generan en release-arquitectura.

## Uso

Selecciona un mueble del catálogo y haz clic en el suelo 3D. Pulsa V para seleccionar; arrastra la pieza por el suelo o usa G (mover), R (girar) y T (escalar). Los campos de Propiedades permiten introducir dimensiones exactas. Supr elimina la selección y Ctrl+Z deshace. Recorrer coloca la cámara a la altura indicada en Luz. Esc regresa al editor. Encuadra la cámara antes de generar un render, también durante el recorrido.

Al imprimir un PDF, utiliza 100 % y desactiva el ajuste a la página. La barra métrica permite comprobar la escala. Si el plano no cabe en el papel, se muestra el error y se conserva la escala elegida.

## Alcance

Versión inicial utilizable. Los espacios son rectangulares, las coincidencias de muros se resuelven para lados completos y la vista muestra una planta cada vez. No hay IFC/BIM, DWG/DXF, escaleras, análisis estructural, trazado de rayos ni comprobación normativa. El render utiliza Three.js con sombras y oclusión ambiental. Las áreas corresponden a las dimensiones del espacio, sin descontar muros. El recorrido no simula física completa. La web necesita cargar desde GitHub Pages; la edición no transmite los proyectos. Windows lleva todos sus recursos y funciona sin conexión.

## Fuente y licencia

La fuente canónica está en [OscarD0823/prisma](https://github.com/OscarD0823/prisma/tree/main/src/architecture). Este repositorio es la exportación independiente generada mediante scripts/architecture-export.mjs: contiene la misma implementación que la suite. Las mejoras deben hacerse en la fuente canónica y exportarse de nuevo. El análisis de [Pascal](https://github.com/pascalorg/editor) está en docs/ANALISIS-PASCAL-Y-PRISMA-ARQUITECTURA.md. Es una implementación propia; no importa el formato Pascal ni copia sus modelos o catálogo.

AGPL-3.0-or-later. Las bibliotecas de terceros conservan sus licencias en THIRD-PARTY-NOTICES.txt dentro de la aplicación compilada. El código fuente correspondiente se incluye en la web y en Windows como prisma-arquitectura-source.tar.gz. Autor: OscarD0823.
