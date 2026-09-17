/**
 * ShowIf 条件：格式 "field=value"（如 https=true）。
 */
export function matchShowIf(
  showIf: string | undefined,
  values: Record<string, unknown>,
): boolean {
  const expr = (showIf || '').trim()
  if (!expr) return true
  const eq = expr.indexOf('=')
  if (eq <= 0) return true
  const key = expr.slice(0, eq).trim()
  const expect = expr.slice(eq + 1).trim()
  const actual = values[key]
  if (expect === 'true' || expect === 'false') {
    const b = actual === true || actual === 'true' || actual === 1 || actual === '1'
    return expect === 'true' ? b : !b
  }
  return String(actual ?? '') === expect
}
