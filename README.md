# Card Heatmap para RemNote

Plugin de solo lectura que inserta un mapa visual debajo del título de cada documento de RemNote. Cada tarjeta se clasifica con base en su historial de respuestas:

- Verde: dominada (al menos 4 repasos y 90% o más de respuestas recordadas).
- Amarillo: en progreso.
- Rojo: difícil (menos de 65% de respuestas recordadas, último resultado olvidado o dos fallos consecutivos).
- Gris: nueva, sin historial de repasos.

Haz clic en cualquier tarjeta para abrir el Rem original. Los botones superiores filtran el heatmap por estado.

## Instalación en desarrollo

1. Descarga o clona este proyecto.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.
4. En RemNote activa el modo desarrollador e instala el plugin desde la carpeta del proyecto.

Para generar el paquete instalable, ejecuta `npm run build`. El archivo resultante es `PluginZip.zip`.

## Privacidad y permisos

El plugin solicita únicamente permiso de lectura sobre los Rems. No crea, modifica ni elimina notas, tarjetas o datos SRS. El historial se procesa localmente dentro del plugin y no se envía a servidores externos.

## Nota sobre la clasificación

La clasificación es una ayuda visual, no sustituye los valores internos del algoritmo FSRS o Anki SM-2. Los umbrales pueden ajustarse en futuras versiones.
