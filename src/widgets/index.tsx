import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerNumberSetting({
    id: 'mastered-reviews', title: 'Repasos mínimos para considerar dominada', defaultValue: 4,
  });
  await plugin.settings.registerBooleanSetting({
    id: 'include-descendants', title: 'Colorear y filtrar Rems dependientes', defaultValue: true,
  });
  await plugin.settings.registerNumberSetting({
    id: 'mastered-success', title: 'Retención mínima para considerar dominada (%)', defaultValue: 90,
  });
  await plugin.settings.registerNumberSetting({
    id: 'difficult-success', title: 'Retención por debajo de la cual es difícil (%)', defaultValue: 65,
  });
  await plugin.app.registerWidget('card_heatmap', WidgetLocation.DocumentBelowTitle, {
    dimensions: { height: 'auto', width: '100%' },
  });
  await plugin.app.registerCommand({
    id: 'card-heatmap-refresh',
    name: 'Actualizar mapa de dominio de la nota',
      action: async () => plugin.app.toast('Usa el botón ↻ del mapa para actualizarlo.'),
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
