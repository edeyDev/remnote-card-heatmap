# Card Heatmap para RemNote

Plugin que inserta un mapa visual debajo del título de cada documento de RemNote y aplica el color nativo al item que contiene cada tarjeta. Cada tarjeta se clasifica con base en su historial de respuestas:

- Verde: dominada (al menos 4 repasos y 90% o más de respuestas recordadas).
- Amarillo: en progreso.
- Rojo: difícil (menos de 65% de respuestas recordadas, último resultado olvidado o dos fallos consecutivos).
- Sin resaltar: nueva, sin historial de repasos.

Haz clic en cualquier tarjeta para abrir el Rem original. Los botones superiores filtran el heatmap por estado.

## Instalación en desarrollo

1. Descarga o clona este proyecto.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.
4. En RemNote activa el modo desarrollador e instala el plugin desde la carpeta del proyecto.

Para generar el paquete instalable, ejecuta `npm run build`. El archivo resultante es `PluginZip.zip`.

## Privacidad y permisos

El plugin necesita permiso de modificación para aplicar el resaltado visual nativo a los Rems. No modifica el texto ni los datos SRS; el historial se procesa localmente dentro del plugin y no se envía a servidores externos.

## Nota sobre la clasificación

La clasificación es una ayuda visual, no sustituye los valores internos del algoritmo FSRS o Anki SM-2. Los umbrales pueden ajustarse en futuras versiones.
