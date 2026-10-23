export function calcHours(entry: any): number {
  if (!entry.clock_in || !entry.clock_out) return 0
  const diff = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000
  return Math.max(0, diff - (entry.total_break_min || 0)/60)
}
export function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
