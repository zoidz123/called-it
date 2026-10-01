// Lightweight Charts draws on a canvas, so it needs resolved colours rather than CSS variables.
export function chartColors() {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string) => style.getPropertyValue(name).trim()
  return {
    win: read('--win'),
    ink: read('--ink'),
    mid: read('--mid'),
    line: read('--line'),
    soft: read('--soft'),
    good: read('--good'),
    goodSoft: read('--good-soft'),
    bad: read('--bad'),
    badSoft: read('--bad-soft'),
  }
}
