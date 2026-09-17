import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerWidget('card_heatmap', WidgetLocation.DocumentBelowTitle, {
    dimensions: { height: 'auto', width: '100%' },
  });
  await plugin.app.registerCommand({
    id: 'card-heatmap-refresh',
    name: 'Actualizar mapa de dominio de la nota',
    action: async () => plugin.app.toast('El mapa se actualiza al volver a abrir la nota.'),
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
