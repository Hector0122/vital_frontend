import React from 'react';
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { guardarAhora, useDataStore } from '../stores/dataStore';
import { hoy } from '../utils/fechas';
import { modeloRapido, modeloWidget } from './modelo';
import { CLICK_MARCAR, MetasWidget } from './MetasWidget';
import { RapidoWidget } from './RapidoWidget';

// Nombres = clases nativas en android/app/src/main/java/com/vital/widget/.
const WIDGETS = {
  Metas: () => {
    const dia = hoy();
    return <MetasWidget metas={modeloWidget(useDataStore.getState(), dia)} hoy={dia} />;
  },
  Rapido: () => {
    const dia = hoy();
    return <RapidoWidget botones={modeloRapido(useDataStore.getState(), dia)} hoy={dia} />;
  },
};

/** Para llamar desde la app cuando cambian los datos. */
export function actualizarWidget(): void {
  for (const [widgetName, renderWidget] of Object.entries(WIDGETS)) {
    requestWidgetUpdate({ widgetName, renderWidget }).catch(() => {});
  }
}

/** Corre en segundo plano, con o sin la app abierta. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  // Con la app cerrada este es un contexto JS nuevo: cargar del disco primero.
  await useDataStore.persist.rehydrate();

  if (props.widgetAction === 'WIDGET_CLICK' && props.clickAction === CLICK_MARCAR) {
    const { actividadId, fecha } = props.clickActionData as { actividadId: string; fecha: string };
    useDataStore.getState().alternarDia(actividadId, fecha);
    await guardarAhora();
  }
  if (props.widgetAction === 'WIDGET_DELETED') return;
  const render = WIDGETS[props.widgetInfo.widgetName as keyof typeof WIDGETS] ?? WIDGETS.Metas;
  props.renderWidget(render());
  // Marcar en un widget también cambia el otro.
  if (props.widgetAction === 'WIDGET_CLICK') actualizarWidget();
}
