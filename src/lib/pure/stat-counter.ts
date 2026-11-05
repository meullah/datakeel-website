// Stat count-up math for the stat-counter island. No imports.

/** prefix + en-US grouped whole number + suffix, e.g. formatStat(10500, '', '+') === '10,500+'. */
export const formatStat = (n: number, prefix = '', suffix = '') =>
  prefix + Math.round(n).toLocaleString('en-US') + suffix;

/** Cubic ease-out on t in [0, 1] (clamped). */
export const easeOut = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
