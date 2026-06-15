export const metadata = { title: 'Privacy Policy - Career Forge' }

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 2026</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">1. Introduction</h2>
      <p>Career Forge (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides an AI-assisted resume and cover letter
      builder. This policy explains what information we collect, how we use it, and the
      choices available to you.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">2. Information We Collect</h2>
      <p>We collect the following categories of information when you use Career Forge:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Account information:</strong> your email address and password, used for
        authentication via our authentication provider (Supabase Auth).</li>
        <li><strong>Profile information:</strong> your stated persona (fresher or experienced
        professional) and your approximate location, which you provide or which is derived
        from your uploaded resume, used to localize document language (UK/US English) and
        run pre-flight eligibility checks.</li>
        <li><strong>Resume and job description content:</strong> the text of any resume you
        upload or enter, and any job description you paste, including your work history,
        education, skills, and contact details contained in those documents.</li>
        <li><strong>Questionnaire responses:</strong> free-text answers you provide when asked
        to elaborate on your work experience.</li>
        <li><strong>Generated documents:</strong> resumes, cover letters, and related content
        generated for you, stored so you can retrieve and re-download them.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">3. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Operate your account and authenticate you.</li>
        <li>Parse your resume and job description into structured data.</li>
        <li>Identify gaps between your resume and a target job description.</li>
        <li>Generate interview-style questions and rewrite resume content based on your answers.</li>
        <li>Generate a tailored resume, cover letter, and PDF documents for download.</li>
        <li>Provide pre-flight eligibility guidance (e.g. visa, work authorization, driving
        licence, relocation) based on information you confirm.</li>
        <li>Suggest networking and job-search resources relevant to your profile.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">4. AI Processing by Third Parties</h2>
      <p>To provide resume parsing, gap analysis, questionnaire generation, and document
      generation, the text content of your resume, job descriptions, and questionnaire
      answers is sent to NVIDIA&apos;s NIM API (a third-party AI inference service) for processing.
      This content is used solely to generate the requested output and is processed
      according to NVIDIA&apos;s own data handling terms for API usage. We do not control how
      NVIDIA&apos;s infrastructure processes requests beyond returning a response to our
      application.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">5. Data Storage</h2>
      <p>Your account data, resume content, job descriptions, questionnaire responses, and
      generated documents are stored in a Supabase-hosted PostgreSQL database and Supabase
      Storage, protected by row-level security so that only you can access your own data.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">6. Data Retention</h2>
      <p>We retain your account data and associated content for as long as your account
      remains active. You may request deletion of your account and associated data at any
      time by contacting us.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">7. Your Rights</h2>
      <p>Depending on your location, you may have rights to access, correct, export, or
      delete your personal data. To exercise these rights, contact us using the details
      below.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">8. Cookies</h2>
      <p>We use essential cookies to maintain your login session via Supabase
      Authentication. These cookies are required for the service to function and cannot be
      disabled. We do not use advertising or third-party tracking cookies. See our{' '}
      <a href="/cookies" className="underline">Cookie Policy</a> for details.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">9. Contact</h2>
      <p>If you have questions about this policy or wish to exercise your data rights,
      please contact us via the support channel provided in the application.</p>
    </div>
  )
}
