import { useEffect, useState } from 'react'

const DEFAULT_STAGES = [
  {
    key: 'ringing',
    label: 'INCOMING CALL',
    dotClass: 'bg-signal animate-ping-slow',
    line1: '07911 224 488',
    line2: 'Mobile · Bolton, BL1',
    footLabel: 'STATUS',
    footValue: 'Ringing…',
    footClass: 'text-signal',
  },
  {
    key: 'answering',
    label: 'AI RECEPTIONIST',
    dotClass: 'bg-signal',
    line1: 'Answered in 1 ring',
    line2: '“NONSTOPAI Taxis, how can I help?”',
    footLabel: 'STATUS',
    footValue: 'Taking booking…',
    footClass: 'text-paper-dim',
  },
  {
    key: 'booked',
    label: 'JOB CONFIRMED',
    dotClass: 'bg-live',
    line1: '14 Mill St → Bolton Rd',
    line2: 'Pickup 6:45pm · Card on file',
    footLabel: 'STATUS',
    footValue: 'Sent to driver',
    footClass: 'text-live',
  },
]

export default function CallTicket({ header = 'DISPATCH LINE', stages = DEFAULT_STAGES }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % stages.length)
    }, 2800)
    return () => clearInterval(id)
  }, [])

  const stage = stages[index]

  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0">
      {/* ambient glow */}
      <div className="absolute -inset-6 bg-signal/10 blur-3xl rounded-full" aria-hidden="true" />

      <div className="relative rounded-2xl border border-ink-line bg-ink-surface shadow-2xl shadow-black/40 overflow-hidden">
        {/* console header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-line bg-ink-surface-2/60">
          <span className="font-mono text-[11px] tracking-widest text-paper-faint">{header}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-live" />
            <span className="font-mono text-[11px] tracking-widest text-live">LIVE</span>
          </span>
        </div>

        <div key={stage.key} className="px-5 py-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
            <span className="font-mono text-[11px] tracking-widest text-paper-faint">{stage.label}</span>
          </div>

          <p className="font-display text-xl font-semibold text-paper mb-1">{stage.line1}</p>
          <p className="text-sm text-paper-dim">{stage.line2}</p>

          <div className="mt-6 pt-4 border-t border-dashed border-ink-line flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-widest text-paper-faint">{stage.footLabel}</span>
            <span className={`font-mono text-xs font-medium ${stage.footClass}`}>{stage.footValue}</span>
          </div>
        </div>

        {/* progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {stages.map((s, i) => (
            <span
              key={s.key}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === index ? 'w-5 bg-signal' : 'w-1.5 bg-ink-line'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
