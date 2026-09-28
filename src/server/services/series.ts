import { addDaysISO, bucketFor, bucketsBetween, bucketStart, formatBucketLabel, formatDateBR, formatDayMonthBR, formatMonthYearBR, type ISODate } from '@/lib/dates';

export type Bucket = 'day' | 'week' | 'month';

export interface BucketAxis {
  bucket: Bucket;
  starts: ISODate[];
  /** Rótulos curtos do eixo X. */
  labels: string[];
  /** Rótulos completos (tooltip e tabela). */
  fullLabels: string[];
}

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function fullLabel(start: ISODate, bucket: Bucket, to: ISODate): string {
  if (bucket === 'month') return formatMonthYearBR(start);
  if (bucket === 'week') {
    const end = addDaysISO(start, 6);
    return `${formatDayMonthBR(start)} a ${formatDayMonthBR(end > to ? to : end)}`;
  }
  const [y, m, d] = start.split('-').map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${formatDateBR(start)} (${WEEKDAY[dow]})`;
}

/** Eixo contínuo de períodos (dia/semana/mês) conforme a duração do intervalo. */
export function buildAxis(from: ISODate, to: ISODate, days: number): BucketAxis {
  const bucket = bucketFor(days);
  const starts = bucketsBetween(from, to, bucket);
  return {
    bucket,
    starts,
    labels: starts.map((s) => formatBucketLabel(s, bucket)),
    fullLabels: starts.map((s) => fullLabel(s, bucket, to)),
  };
}

/** Soma pontos diários nos períodos do eixo (períodos sem dados ficam com zero). */
export function aggregateSeries(points: { date: ISODate; value: number }[], axis: BucketAxis): number[] {
  const index = new Map(axis.starts.map((start, i) => [start, i]));
  const values = axis.starts.map(() => 0);
  for (const point of points) {
    const i = index.get(bucketStart(point.date, axis.bucket));
    if (i !== undefined) values[i]! += point.value;
  }
  return values;
}
