interface PreflightPanelProps {
  jobMarket: string | null
  location: string | null
  preScreeningDetails: string[]
  jdText: string
}

type CheckStatus = 'pass' | 'warning' | 'fail'

interface Check {
  id: string
  label: string
  status: CheckStatus
  message: string
}

function buildChecks({ jobMarket, location, preScreeningDetails, jdText }: PreflightPanelProps): Check[] {
  const checks: Check[] = []
  const details = preScreeningDetails || []
  const jd = jdText || ''
  const jdLower = jd.toLowerCase()

  if (jobMarket === 'GB') {
    const hasVisaDeclaration = details.some((d) => /visa|right to work|sponsorship/i.test(d))
    checks.push({
      id: 'visa',
      label: 'VISA SPONSORSHIP STATUS',
      status: hasVisaDeclaration ? 'pass' : 'warning',
      message: hasVisaDeclaration
        ? 'COMPATIBLE — user has declared their status'
        : 'No visa/right to work status declared. Some UK employers require this upfront.',
    })
  }

  const hasRelocationDeclaration = details.some((d) => /relocat/i.test(d))
  const isAlreadyLocal = !hasRelocationDeclaration && !!location && jdLower.includes(location.toLowerCase())
  checks.push({
    id: 'relocation',
    label: 'GEOGRAPHIC / RELOCATION MATCH',
    status: hasRelocationDeclaration || isAlreadyLocal ? 'pass' : 'warning',
    message: hasRelocationDeclaration
      ? 'VALIDATED — relocation willingness declared'
      : isAlreadyLocal
      ? 'VALIDATED — already local'
      : 'Relocation status not declared. Consider adding this if the role requires it.',
  })

  if (jobMarket === 'GB') {
    const jdRequiresLicence = /driving licence|driver's licence|full licence|own transport/i.test(jd)
    if (jdRequiresLicence) {
      const hasLicenceDeclaration = details.some((d) => /driving licence|full licence/i.test(d))
      checks.push({
        id: 'licence',
        label: 'MANDATORY CREDENTIAL CHECK',
        status: hasLicenceDeclaration ? 'pass' : 'warning',
        message: hasLicenceDeclaration
          ? 'CONFIRMED — driving licence declared'
          : 'This JD requires a driving licence. Ensure this is accurate in your application.',
      })
    }
  }

  return checks
}

export function PreflightPanel(props: PreflightPanelProps) {
  const checks = buildChecks(props)

  if (checks.length === 0) return null

  return (
    <div className="mt-4 border rounded-lg p-4 bg-gray-50 font-mono text-xs">
      <p className="text-gray-500 mb-3 font-sans text-xs font-medium uppercase tracking-wide">
        Application Pre-Flight Audit
      </p>

      {checks.map((check) => (
        <div key={check.id} className="mb-2">
          <span className={
            check.status === 'pass' ? 'text-green-600' :
            check.status === 'warning' ? 'text-amber-600' :
            'text-red-600'
          }>
            {check.status === 'pass' ? '[✓]' :
             check.status === 'warning' ? '[!]' :
             '[✗]'}
          </span>
          {' '}
          <span className="font-semibold">{check.label}:</span>
          {' '}
          <span className="text-gray-600">{check.message}</span>
        </div>
      ))}
    </div>
  )
}
