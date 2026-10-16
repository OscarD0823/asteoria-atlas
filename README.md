# Auralis Atlas · BETA

CAD, arquitectura y espacios en 3D. Parte del entorno común [Auralis](https://github.com/OscarD0823/auralis).

[Usar aplicación](https://oscard0823.github.io/auralis-atlas/) · [Descargas](https://github.com/OscarD0823/auralis-atlas/releases) · [Guía de construcción](docs/BUILD-MODE.md)

El catálogo inferior reúne construcción, mobiliario y acabados. Coloca objetos con vista previa, giro, altura, cuadrícula y superposición opcional. Dibuja espacios arrastrando, mueve habitaciones con su contenido, copia distribuciones y demuele paredes conservando el suelo. Incluye 92 modelos paramétricos, importación 2D/3D, terreno, iluminación, recorrido y render.

El autoguardado utiliza la biblioteca local existente y muestra el último guardado. Los proyectos nuevos usan `.auralis-atlas` y formato v4; se admiten `.atlas`, `.prisma-arquitectura` y los formatos internos v1–v3. Conserva una copia original si debes seguir usando una versión anterior de Atlas.

La implementación CAD está en `src/architecture/` y sus pruebas en `tests/`. El núcleo y los recursos compartidos se consumen mediante el entorno Auralis; la misma entrada sirve a la aplicación independiente y a la suite. Desde este módulo, `node tools/workspace.mjs dev` utiliza el entorno común configurado. Desde el núcleo, `pnpm dev:architecture` inicia Atlas.

Procesamiento local. Software AGPL-3.0-or-later, con avisos y licencias de terceros. Autor: OscarD0823.
