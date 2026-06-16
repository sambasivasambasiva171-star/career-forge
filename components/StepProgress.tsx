const STEPS = ['Profile', 'Details & JD', 'Generate CV', 'Dashboard']

export default function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 py-4 overflow-x-auto">
      {STEPS.map((label, i) => {
        const step = i + 1
        const isDone = step < current
        const isCurrent = step === current
        return (
          <div key={label} className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
                  ${isDone ? 'bg-blue-600 text-white' : isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}
              >
                {isDone ? '✓' : step}
              </div>
              <span className={`text-xs ${isCurrent ? 'font-medium text-blue-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {step < STEPS.length && <div className={`h-px w-6 sm:w-12 ${isDone ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}
