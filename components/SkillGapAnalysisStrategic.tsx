'use client'

import { ReadinessScore, HiringProbability } from '@/lib/utils/skill-readiness-score'
import { CompetitiveAdvantage } from '@/lib/utils/competitive-advantages'

interface SkillGapAnalysisStrategicProps {
  readiness: ReadinessScore
  hiringProbability: HiringProbability
  competitiveAdvantages: CompetitiveAdvantage[]
  strategicNarrative: string
  jobTitle: string
}

export default function SkillGapAnalysisStrategic({
  readiness,
  hiringProbability,
  competitiveAdvantages,
  strategicNarrative,
  jobTitle,
}: SkillGapAnalysisStrategicProps) {
  return (
    <div className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">Your Match for {jobTitle}</h2>
        <p className="text-gray-600">Strategic analysis (not line-by-line comparison)</p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
        <h3 className="font-semibold mb-4">Readiness Breakdown</h3>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Ready Immediately</span>
              <span className="text-lg font-bold text-green-600">{readiness.ready_immediately}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full"
                style={{ width: `${readiness.ready_immediately}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              You have the core competencies now. No training needed for these.
            </p>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Trainable (Employer Provides)</span>
              <span className="text-lg font-bold text-amber-600">{readiness.trainable_gaps}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-amber-400 h-3 rounded-full"
                style={{ width: `${readiness.trainable_gaps}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Job-specific skills. You&apos;ll learn these on the job (typically {readiness.time_to_full_competency}–20 days).
            </p>
          </div>

          <div className="pt-2 border-t">
            <div className="flex justify-between">
              <span className="text-sm font-semibold text-gray-800">Total Readiness</span>
              <span className="text-xl font-bold text-blue-600">{readiness.overall}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
        <h3 className="font-semibold text-green-900 mb-2">Your Hiring Probability</h3>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-green-600">{hiringProbability.probability}%</span>
          <span className="text-sm text-green-700 font-medium">({hiringProbability.confidence} confidence)</span>
        </div>
        <p className="text-sm text-green-800 mb-3">
          Based on analysis of your core competencies, trainable gaps, and ramp-up time.
        </p>
        <details className="text-sm text-green-700">
          <summary className="cursor-pointer font-medium">Why this probability?</summary>
          <ul className="mt-2 ml-4 space-y-1 list-disc text-green-700">
            {hiringProbability.reasoning.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </details>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-green-200 bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-green-900 mb-2">Core Competencies ✅</h4>
          <p className="text-sm text-green-700 mb-3">
            {readiness.core_competencies.pct}% match ({readiness.core_competencies.matched}/{readiness.core_competencies.total})
          </p>
          <p className="text-xs text-green-600">
            You have the skills that are hard to train. This is your biggest strength.
          </p>
        </div>

        <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Transferable Skills ✨</h4>
          <p className="text-sm text-blue-700 mb-3">
            {readiness.transferable.pct}% match ({readiness.transferable.matched}/{readiness.transferable.total})
          </p>
          <p className="text-xs text-blue-600">
            You can apply skills from previous roles to this position.
          </p>
        </div>

        <div className="border border-amber-200 bg-amber-50 p-4 rounded-lg">
          <h4 className="font-semibold text-amber-900 mb-2">Job-Specific Training 🟡</h4>
          <p className="text-sm text-amber-700 mb-3">
            {readiness.job_specific.matched}/{readiness.job_specific.total} skills
          </p>
          <p className="text-xs text-amber-600">
            Employer trains everyone on these. Learn in {readiness.time_to_full_competency}–20 days.
          </p>
        </div>

        <div className="border border-gray-200 bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Baseline Skills ✓</h4>
          <p className="text-sm text-gray-700 mb-3">
            {readiness.baseline.pct}% match ({readiness.baseline.matched}/{readiness.baseline.total})
          </p>
          <p className="text-xs text-gray-600">
            Basic professionalism, honesty, literacy. You&apos;ve got these.
          </p>
        </div>
      </div>

      {competitiveAdvantages.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-900 mb-3">Your Competitive Advantages ✨</h3>
          <div className="space-y-3">
            {competitiveAdvantages.map((adv, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-purple-100">
                <h4 className="font-medium text-purple-900 text-sm">{adv.title}</h4>
                <p className="text-xs text-purple-700 mt-1">{adv.description}</p>
                <p className="text-xs text-purple-600 mt-1 italic">Evidence: {adv.cvEvidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Strategic Feedback</h3>
        <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">{strategicNarrative}</p>
      </div>

      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
        <h3 className="font-semibold text-green-900 mb-3">Your Action Items</h3>
        <ol className="space-y-2 text-sm text-green-800 list-decimal ml-5">
          <li>
            <strong>Tailor your CV:</strong> Emphasize core strengths. Add an Achievements section.
          </li>
          <li>
            <strong>Cover letter hook:</strong> &quot;I bring proven [core competency]. I&apos;ll master job-specific skills quickly.&quot;
          </li>
          <li>
            <strong>Prepare for interview:</strong> Expect &quot;Why hire you with no [experience]?&quot; Answer: &quot;I have the core competencies you can&apos;t train.&quot;
          </li>
          <li>
            <strong>Apply with confidence:</strong> Your {hiringProbability.probability}% probability is above average.
          </li>
        </ol>
      </div>
    </div>
  )
}
