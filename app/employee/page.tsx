import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Bricolage_Grotesque } from 'next/font/google'
import ClockCard from '@/components/clock-card'
import SignOutButton from '@/components/signout-button'

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
})

const manilaDate = (date = new Date()) =>
  date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

const manilaDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    hour12: true,
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

export default async function EmployeePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { data: settings }, { data: openEntry }, { data: todayEntry }, { data: history }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('company_settings').select('*').limit(1).single(),
      supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user.id)
        .eq('date', manilaDate())
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user.id)
        .order('clock_in', { ascending: false })
        .limit(30),
    ])

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'there'
  const entries = history || []
  const completedEntries = entries.filter((entry: any) => entry.clock_in && entry.clock_out)
  const totalMinutes = completedEntries.reduce((sum: number, entry: any) => {
    const minutes =
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000
    return sum + Math.max(0, minutes)
  }, 0)
  const totalHours = (totalMinutes / 60).toFixed(1)

  return (
    <main className="min-h-screen bg-[#EEEAFF] p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        {/* Brand header */}
        <header className="relative isolate overflow-hidden rounded-[24px] sm:rounded-[28px] bg-[#4B2BF0] p-5 text-white shadow-[0_24px_60px_-24px_rgba(60,30,200,0.55)] sm:p-7">
          <div
            aria-hidden
            className="absolute -right-14 -top-20 -z-10 h-56 w-56 rounded-full bg-[#FF5A4E]"
          />
          <div
            aria-hidden
            className="absolute right-28 -bottom-24 -z-10 h-44 w-44 rounded-full bg-[#7A5CFF]"
          />
          <div
            aria-hidden
            className="absolute left-[42%] -top-24 -z-10 h-40 w-40 rounded-full bg-white/10"
          />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-lg font-extrabold text-[#4B2BF0] shadow-sm">
                C
              </div>
              <div className="min-w-0">
                <div className={`${display.className} text-xl font-extrabold leading-tight sm:text-2xl`}>
                  ChronoKeep
                </div>
                <div className="mt-0.5 truncate text-xs text-white/75 sm:text-sm">
                  Employee workspace · {profile?.email || user.email}
                </div>
              </div>
            </div>
            <div className="shrink-0 rounded-xl bg-white p-1 text-slate-900 shadow-sm">
              <SignOutButton />
            </div>
          </div>

          <div className="relative mt-8 flex flex-col justify-between gap-5 sm:mt-10 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#2EE6A6]" />
                YOUR DAY, IN SYNC
              </div>
              <h1 className={`${display.className} text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl`}>
                Good day, {firstName}!
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
                One place to keep your time on track. Check in, stay focused, and keep your workday moving.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm sm:min-w-[190px]">
              <div className="text-xs font-medium text-white/70">TODAY · DAVAO CITY TIME</div>
              <div className={`${display.className} mt-1 text-lg font-bold`}>
                {new Date().toLocaleDateString('en-PH', {
                  timeZone: 'Asia/Manila',
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className="mt-1 text-xs text-white/70">Waho Solutions Inc.</div>
            </div>
          </div>
        </header>

        {/* Quick overview */}
        <section aria-label="Your overview" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-[20px] border border-white bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[#14102B]">Today&apos;s status</div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                openEntry
                  ? 'bg-[#E3FBF2] text-[#0B7A55]'
                  : todayEntry
                    ? 'bg-[#FFF4D6] text-[#8A5A00]'
                    : 'bg-[#EEEAFF] text-[#4B2BF0]'
              }`}>
                {openEntry ? 'CLOCKED IN' : todayEntry ? 'SHIFT RECORDED' : 'NOT CLOCKED IN'}
              </span>
            </div>
            <div className={`${display.className} mt-3 text-2xl font-extrabold text-[#14102B]`}>
              {openEntry ? 'You’re on the clock' : todayEntry ? 'Nice work today' : 'Ready when you are'}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {openEntry
                ? `Started at ${manilaTime(openEntry.clock_in)}`
                : todayEntry?.clock_out
                  ? `Last shift ended at ${manilaTime(todayEntry.clock_out)}`
                  : 'Use the time clock below to record your shift.'}
            </p>
          </div>

          <div className="rounded-[20px] border border-white bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#14102B]">Latest shift</div>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFF4D6] text-[#8A5A00]" aria-hidden>◷</span>
            </div>
            <div className={`${display.className} mt-3 text-2xl font-extrabold text-[#14102B]`}>
              {todayEntry?.clock_in ? manilaTime(todayEntry.clock_in) : '—'}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {todayEntry?.clock_in ? 'Your most recent clock-in today' : 'Your clock-in time will appear here'}
            </p>
          </div>

          <div className="rounded-[20px] border border-white bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#14102B]">Recent hours</div>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E3FBF2] text-[#0B7A55]" aria-hidden>↗</span>
            </div>
            <div className={`${display.className} mt-3 text-2xl font-extrabold text-[#14102B]`}>
              {totalHours}<span className="ml-1 text-sm font-bold text-slate-400">hrs</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Across completed shifts in your latest 30 records</p>
          </div>
        </section>

        {/* Main workspace */}
        <div className="grid items-start gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <h2 className={`${display.className} text-xl font-extrabold text-[#14102B] sm:text-2xl`}>
                  Your time clock
                </h2>
                <p className="mt-1 text-sm text-slate-500">Record your shift in just a moment.</p>
              </div>
              <span className="hidden rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#4B2BF0] sm:inline-flex">
                LIVE WORKSPACE
              </span>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-white bg-white p-3 shadow-sm sm:p-5">
              <ClockCard
                profile={profile}
                todayEntry={todayEntry}
                openEntry={openEntry}
                settings={settings || { start_time: '09:00', grace_minutes: 15 }}
              />
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#DCD4FF] bg-white/70 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEEAFF] text-[#4B2BF0]" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4l2.5 1.5" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <div className="text-sm font-bold text-[#14102B]">A little timekeeping tip</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Remember to clock out when your shift ends so your recorded hours stay accurate.
                </p>
              </div>
            </div>
          </section>

          {/* Shift history */}
          <section className="min-w-0 overflow-hidden rounded-[24px] border border-white bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-[#EEEAFF] p-5 sm:p-6">
              <div>
                <h2 className={`${display.className} text-xl font-extrabold text-[#14102B] sm:text-2xl`}>
                  My shift history
                </h2>
                <p className="mt-1 text-sm text-slate-500">Your latest 30 time records.</p>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EEEAFF] text-[#4B2BF0]" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 5h16M4 10h16M4 15h10M4 20h7" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <div className="max-h-[620px] space-y-3 overflow-y-auto p-4 sm:p-5">
              {entries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCD4FF] bg-[#FAF9FF] px-5 py-10 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#EEEAFF] text-xl text-[#4B2BF0]" aria-hidden>
                    ◷
                  </div>
                  <div className={`${display.className} mt-3 font-bold text-[#14102B]`}>Your story starts here</div>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                    Your shifts will appear here after your first clock-in.
                  </p>
                </div>
              ) : (
                entries.map((entry: any, index: number) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-[#EEEAFF] bg-[#FAF9FF] p-3.5 transition hover:border-[#C9BEFF] hover:bg-white sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold ${
                          index % 3 === 0
                            ? 'bg-[#EEEAFF] text-[#4B2BF0]'
                            : index % 3 === 1
                              ? 'bg-[#FFF0EE] text-[#D93F35]'
                              : 'bg-[#E3FBF2] text-[#0B7A55]'
                        }`}>
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#14102B]">
                            {new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-PH', {
                              timeZone: 'Asia/Manila',
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {entry.mode || 'Standard shift'} · {entry.status || 'Recorded'}
                          </div>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        !entry.clock_out
                          ? 'bg-[#E3FBF2] text-[#0B7A55]'
                          : 'bg-white text-slate-500'
                      }`}>
                        {entry.clock_out ? 'COMPLETED' : 'ONGOING'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clock in</div>
                        <div className="mt-1 text-sm font-bold tabular-nums text-[#14102B]">
                          {entry.clock_in ? manilaTime(entry.clock_in) : '—'}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clock out</div>
                        <div className="mt-1 text-sm font-bold tabular-nums text-[#14102B]">
                          {entry.clock_out ? manilaTime(entry.clock_out) : 'In progress'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
                      <span>{entry.clock_in ? manilaDateTime(entry.clock_in) : entry.date}</span>
                      {entry.clock_out && entry.clock_in ? (
                        <span className="font-semibold text-[#4B2BF0]">
                          {Math.max(
                            0,
                            (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000,
                          ).toFixed(2)}{' '}
                          hrs
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="border-t border-[#EEEAFF] bg-[#FAF9FF] px-5 py-3 text-xs text-slate-500">
              All times are displayed in Davao City time (UTC+8).
            </div>
          </section>
        </div>

        <footer className="flex flex-col items-center justify-between gap-2 px-1 pb-2 text-center text-xs text-slate-400 sm:flex-row sm:text-left">
          <span>© {new Date().getFullYear()} ChronoKeep · Waho Solutions Inc.</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#2EE6A6]" />
            Your time, thoughtfully tracked.
          </span>
        </footer>
      </div>
    </main>
  )
}
