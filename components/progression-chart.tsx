import { Fragment, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { AppTheme } from '@/constants/theme';

export const progressionSeriesColors = [AppTheme.colors.primary, AppTheme.colors.success];

export type ProgressionChartPoint = {
  id: string;
  label: string;
  accessibilityLabel: string;
  values: (number | null)[];
};

type ProgressionChartProps = {
  kind: 'line' | 'bar';
  points: ProgressionChartPoint[];
  seriesCount: number;
  breakdown?: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
};

const axisWidth = 38;
const plotTop = 12;
const plotBottom = 166;
const chartHeight = 200;

export function ProgressionChart({ kind, points, seriesCount, breakdown, selectedId, onSelect }: ProgressionChartProps) {
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const percent = kind === 'line';
  const highest = points.reduce((max, point) => Math.max(max, ...point.values.map((value) => value ?? 0)), 0);
  const interval = percent ? 25 : Math.max(1, Math.ceil(highest / 4));
  const tickCount = percent ? 4 : Math.max(1, Math.ceil(highest / interval));
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => index * interval);
  const y = (value: number) => plotBottom - value / (tickCount * interval) * (plotBottom - plotTop);
  const plotWidth = Math.max(width - axisWidth, points.length * (breakdown ? 70 : 28));
  const step = plotWidth / Math.max(points.length, 1);
  const x = (index: number) => (index + 0.5) * step;
  const labelEvery = breakdown ? 1 : Math.ceil(54 / step);
  const selectedIndex = points.findIndex((point) => point.id === selectedId);

  return (
    <View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={styles.chart}>
      {width > axisWidth && points.length > 0 ? (
        <>
          <View style={styles.axis} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
            {ticks.map((tick) => (
              <Text key={tick} style={[styles.axisText, { top: y(tick) - 8 }]}>{tick}{percent ? '%' : ''}</Text>
            ))}
          </View>
          <ScrollView
            ref={scroll}
            horizontal
            style={styles.plotScroll}
            onContentSizeChange={() => {
              if (breakdown || selectedIndex < 0) return;
              const viewport = width - axisWidth;
              const offset = Math.max(0, Math.min(plotWidth - viewport, x(selectedIndex) - viewport / 2));
              scroll.current?.scrollTo({ x: offset, animated: false });
            }}>
            <View style={{ width: plotWidth, height: chartHeight }}>
              <Svg width={plotWidth} height={chartHeight} pointerEvents="none" aria-hidden>
                {selectedIndex >= 0 ? (
                  <Rect x={selectedIndex * step} y={plotTop} width={step} height={plotBottom - plotTop} fill={AppTheme.colors.primaryWash} />
                ) : null}
                {ticks.map((tick) => (
                  <Line key={tick} x1={0} x2={plotWidth} y1={y(tick)} y2={y(tick)} stroke={AppTheme.colors.border} />
                ))}
                {kind === 'line' ? (
                  <LinePlot points={points} seriesCount={seriesCount} x={x} y={y} selectedIndex={selectedIndex} />
                ) : (
                  <BarPlot points={points} step={step} x={x} y={y} selectedIndex={selectedIndex} />
                )}
              </Svg>
              <View style={styles.targets} role="radiogroup" aria-label={breakdown ? 'Chart categories' : 'Chart matches'}>
                {points.map((point, index) => {
                  const selected = index === selectedIndex;
                  return (
                    <Pressable
                      key={point.id}
                      accessibilityLabel={point.accessibilityLabel}
                      role="radio"
                      aria-checked={selected}
                      onPress={() => onSelect(point.id)}
                      style={({ pressed }) => [styles.target, { width: step }, pressed && styles.pressed]}>
                      {index % labelEvery === 0 || points.length === 1 ? (
                        <Text numberOfLines={1} style={[styles.xLabel, selected && styles.selectedLabel]}>{point.label}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

type PlotProps = {
  points: ProgressionChartPoint[];
  x: (index: number) => number;
  y: (value: number) => number;
  selectedIndex: number;
};

function LinePlot({ points, seriesCount, x, y, selectedIndex }: PlotProps & { seriesCount: number }) {
  return Array.from({ length: seriesCount }, (_, series) => {
    const coordinates = points.map((point, index) => {
      const value = point.values[series];
      return value == null ? null : { x: x(index), y: y(value) };
    });
    const path = coordinates.flatMap((point, index) =>
      point ? [`${coordinates[index - 1] ? 'L' : 'M'}${point.x},${point.y}`] : []).join(' ');
    const color = progressionSeriesColors[series];

    return (
      <Fragment key={series}>
        {path ? <Path d={path} fill="none" stroke={color} strokeWidth={2} strokeDasharray={series > 0 ? [5, 4] : undefined} /> : null}
        {coordinates.map((point, index) => point ? (
          <Circle key={points[index].id} cx={point.x} cy={point.y} r={index === selectedIndex ? 5 : 3}
            fill={color} stroke={AppTheme.colors.background} strokeWidth={1} />
        ) : null)}
      </Fragment>
    );
  });
}

function BarPlot({ points, step, x, y, selectedIndex }: PlotProps & { step: number }) {
  const width = Math.min(34, step * 0.62);
  return points.map((point, index) => {
    const value = point.values[0];
    if (value == null) return null;
    const height = Math.max(2, plotBottom - y(value));
    return (
      <Rect
        key={point.id}
        x={x(index) - width / 2}
        y={plotBottom - height}
        width={width}
        height={height}
        rx={3}
        fill={AppTheme.colors.primary}
        opacity={selectedIndex === index ? 1 : 0.65}
      />
    );
  });
}

const styles = StyleSheet.create({
  chart: { height: chartHeight, flexDirection: 'row' },
  axis: { width: axisWidth, height: chartHeight },
  axisText: { position: 'absolute', right: 7, color: AppTheme.colors.textMuted, fontSize: 11, lineHeight: 16 },
  plotScroll: { flex: 1, minWidth: 0 },
  targets: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  target: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
  pressed: { backgroundColor: AppTheme.colors.primaryWash },
  xLabel: { color: AppTheme.colors.textMuted, fontSize: 11 },
  selectedLabel: { color: AppTheme.colors.primary, fontWeight: '800' },
});
