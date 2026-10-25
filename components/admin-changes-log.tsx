import { Bricolage_Grotesque } from 'next/font/google'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

type LogRow = {
  id: number
  created_at: string
  actor_name: string | null
  actor_email: string | null
  action: 'edit' | 'force_clock_out' | 'delete' | 'delete_employee' | 'reset_password'
  employee_name: string | null
  before_data: any
  after_data: any
  reason: string | null
}

// Date + time of the change, to the second, in Manila time
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })

const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : 'none'

const ACTIONS = {
  edit: { label: 'Edited times', cls: 'bg-[#EEEAFF] text-[#4B2BF0]' },
  force_clock_out: { label: 'Forced clock out', cls: 'bg-[#FFF4D6] text-[#8A5A00]' },
  delete: { label: 'Deleted record', cls: 'bg-[#FFF1EF] text-[#B42318]' },
  delete_employee: { label: 'Deleted employee', cls: 'bg-[#FFE1DD] text-[#912018]' },
  reset_password: { label: 'Reset password', cls: 'bg-[#E3FBF2] text-[#0B7A55]' },
} as const

function details(row: LogRow): string[] {
  const b = row.before_data || {}
  const a = row.after_data || {}
  if (row.action === 'edit') {
    const out: string[] = []
    if (b.clock_in !== a.clock_in) out.push(`Clock in: ${when(b.clock_in)} → ${when(a.clock_in)}`)
    if (b.clock_out !== a.clock_out) out.push(`Clock out: ${when(b.clock_out)} → ${when(a.clock_out)}`)
    return out.length ? out : ['No time values changed']
  }
  if (row.action === 'force_clock_out') return [`Clock out set to ${when(a.clock_out)}`, `Clock in was ${when(b.clock_in)}`]
  if (row.action === 'reset_password') return ['Password reset by an admin', 'The new password is not stored']
  if (row.action === 'delete_employee') {
    const n = Number(b.time_entries_count ?? 0)
    return [`${b.email ?? 'No email'} · ${b.role ?? 'No role'}${b.department ? ` · ${b.department}` : ''}`, `${n} time record${n === 1 ? '' : 's'} on file at deletion`]
  }
  return [`Record for ${b.date ?? 'unknown date'}`, `In ${when(b.clock_in)} · Out ${when(b.clock_out)}`]
}

export default function AdminChangesLog({ logs, errorMessage }: { logs: LogRow[]; errorMessage?: string | null }) {
  return (
    <section className="rounded-[24px] bg-white shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-[#EEEAFF] flex items-center justify-between gap-3">
        <div>
          <h2 className={`${display.className} text-[18px] sm:text-[20px] font-bold text-[#14102B]`}>Admin changes log</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">Every edit, forced clock out, deletion and password reset. Entries can&apos;t be changed or removed.</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#E3FBF2] text-[#0B7A55] px-2.5 py-1 text-[12px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2EE6A6]" aria-hidden /> Locked
        </span>
      </div>

      {errorMessage && (
        <div role="alert" className="m-4 text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">
          Couldn&apos;t load the admin changes log: {errorMessage}. If you haven&apos;t yet, run <code>supabase/admin-audit.sql</code> in Supabase.
        </div>
      )}

      {!errorMessage && logs.length === 0 && (
        <div className="p-10 text-center text-[14px] text-slate-500">No admin changes yet. Edits, forced clock outs and deletions will appear here.</div>
      )}

      {logs.length > 0 && (
        <div className="max-h-[520px] overflow-auto">
          <div className="hidden md:grid grid-cols-[225px_150px_150px_150px_1fr] gap-3 px-5 py-3 bg-[#F6F4FF] text-[13px] font-semibold text-slate-600 sticky top-0">
            <div>Date &amp; time</div><div>Admin</div><div>Action</div><div>Employee</div><div>Details</div>
          </div>
          <ul className="divide-y divide-[#EEEAFF]">
            {logs.map((row) => {
              const meta = ACTIONS[row.action] ?? { label: row.action, cls: 'bg-slate-100 text-slate-600' }
              return (
                <li key={row.id} className="p-4 md:px-5 md:py-3.5 md:grid md:grid-cols-[225px_150px_150px_150px_1fr] md:gap-3 md:items-start text-[13px]">
                  <div className="font-semibold text-[#14102B] tabular-nums">{stamp(row.created_at)}</div>
                  <div className="mt-1 md:mt-0 text-slate-600">
                    <span className="md:hidden text-slate-400">By </span>{row.actor_name || row.actor_email || 'Unknown admin'}
                  </div>
                  <div className="mt-2 md:mt-0"><span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${meta.cls}`}>{meta.label}</span></div>
                  <div className="mt-2 md:mt-0 text-[#14102B]"><span className="md:hidden text-slate-400">Employee: </span>{row.employee_name || 'Unknown'}</div>
                  <div className="mt-2 md:mt-0 text-slate-600 space-y-0.5">
                    {details(row).map((line, i) => <div key={i}>{line}</div>)}
                    {row.reason && <div className="text-slate-500 italic">Reason: {row.reason}</div>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
