import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { Actividad, Area, Registro } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { celdasDelMes, hoy, parseIso } from '../utils/fechas';
import { balanceMes } from '../utils/resumen';
import { Destacados } from './Destacados';

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Props {
  areas: Area[];
  actividades: Actividad[];
  registros: Registro[];
  onElegirDia: (fecha: string) => void; // salta a la semana de ese día
}

/** El mes de un vistazo: puntos por área, días sin registro en neutro. Sin porcentajes. */
export function MesView({ areas, actividades, registros, onElegirDia }: Props) {
  const ahora = parseIso(hoy());
  const [mes, setMes] = useState({
    anio: ahora.getFullYear(),
    mes: ahora.getMonth(),
  });
  const celdas = celdasDelMes(mes.anio, mes.mes);
  const hoyIso = hoy();
  const esActual =
    mes.anio === ahora.getFullYear() && mes.mes === ahora.getMonth();

  const areaDe = new Map(actividades.map(a => [a.id, a.areaId]));
  const areasPorDia = new Map<string, Set<string>>();
  const prefijo = `${mes.anio}-${String(mes.mes + 1).padStart(2, '0')}-`;
  for (const r of registros) {
    const areaId = areaDe.get(r.actividadId);
    if (!r.fecha.startsWith(prefijo) || !areaId) continue;
    if (!areasPorDia.has(r.fecha)) areasPorDia.set(r.fecha, new Set());
    areasPorDia.get(r.fecha)!.add(areaId);
  }
  const ordenadas = [...areas].sort((a, b) => a.orden - b.orden);
  const diasPorArea = ordenadas
    .map(area => ({
      area,
      dias: [...areasPorDia.values()].filter(s => s.has(area.id)).length,
    }))
    .filter(x => x.dias > 0);

  const { mensajes } = balanceMes(registros, actividades, mes.anio, mes.mes, hoyIso);

  const mover = (delta: number) =>
    setMes(({ anio, mes: m }) => {
      const d = new Date(anio, m + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  const titulo = new Date(mes.anio, mes.mes, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.contenedor}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => mover(-1)}
          hitSlop={12}
          accessibilityLabel="Mes anterior"
        >
          <Icon name="chevron-left" size={iconSize.lg} color={colors.muted} />
        </Pressable>
        <Text style={styles.titulo}>{titulo}</Text>
        <Pressable
          onPress={() => mover(1)}
          disabled={esActual}
          hitSlop={12}
          accessibilityLabel="Mes siguiente"
          style={esActual && styles.oculto}
        >
          <Icon name="chevron-right" size={iconSize.lg} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {INICIALES.map((l, i) => (
          <Text key={`i${i}`} style={styles.inicial}>
            {l}
          </Text>
        ))}
        {celdas.map((fecha, i) => {
          if (!fecha) return <View key={`h${i}`} style={styles.celda} />;
          const presentes = ordenadas.filter(a =>
            areasPorDia.get(fecha)?.has(a.id),
          );
          const futuro = fecha > hoyIso;
          return (
            <Pressable
              key={fecha}
              style={[
                styles.celda,
                fecha === hoyIso && styles.celdaHoy,
                futuro && styles.futuro,
              ]}
              disabled={futuro}
              onPress={() => onElegirDia(fecha)}
              accessibilityLabel={`${parseIso(fecha).getDate()}: ${
                presentes.map(a => a.nombre).join(', ') || 'sin registros'
              }`}
            >
              <Text
                style={[
                  styles.numero,
                  fecha === hoyIso && { color: colors.primary },
                ]}
              >
                {parseIso(fecha).getDate()}
              </Text>
              <View style={styles.puntos}>
                {presentes.slice(0, 4).map(a => (
                  <View
                    key={a.id}
                    style={[styles.punto, { backgroundColor: a.color }]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {mensajes.length ? <Destacados mensajes={mensajes} /> : null}

      {diasPorArea.length ? (
        <View style={styles.card}>
          {diasPorArea.map(({ area, dias }) => (
            <View key={area.id} style={styles.fila}>
              <View
                style={[
                  styles.punto,
                  styles.puntoGrande,
                  { backgroundColor: area.color },
                ]}
              />
              <Text style={styles.body}>{area.nombre}</Text>
              <Text style={styles.muted}>
                {dias} {dias === 1 ? 'día' : 'días'}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>No hay registros este mes.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: spacing.sm },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: { ...type.label, color: colors.muted, textTransform: 'uppercase' },
  oculto: { opacity: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  inicial: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...type.caption,
    color: colors.muted,
    marginBottom: 4,
  },
  celda: {
    width: `${100 / 7}%`,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.sm,
  },
  celdaHoy: { borderWidth: 1, borderColor: colors.primary },
  futuro: { opacity: 0.35 },
  numero: { ...type.bodySm, color: colors.text },
  puntos: { flexDirection: 'row', gap: 2, height: 6 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  puntoGrande: { width: 10, height: 10, borderRadius: 5 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
  },
  body: { ...type.bodySm, color: colors.text, flex: 1 },
  muted: { ...type.bodySm, color: colors.muted },
});
