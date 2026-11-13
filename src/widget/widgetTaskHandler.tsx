import React from 'react';
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { guardarAhora, useDataStore } from '../stores/dataStore';
import { hoy } from '../utils/fechas';
import { modeloWidget } from './modelo';
import { CLICK_MARCAR, MetasWidget } from './MetasWidget';

export const WIDGET_NAME = 'Metas';

const render = () => {
  const dia = hoy();
  return <MetasWidget metas={modeloWidget(useDataStore.getState(), dia)} hoy={dia} />;
};

/** Para llamar desde la app cuando cambian los datos. */
export function actualizarWidget(): void {
  requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: render }).catch(() => {});
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
  if (props.widgetAction !== 'WIDGET_DELETED') props.renderWidget(render());
}
