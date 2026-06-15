export const metadata = { title: 'Cookie Policy - Career Forge' }

export default function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose">
      <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 2026</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">What Cookies We Use</h2>
      <p>Career Forge uses only <strong>essential cookies</strong> set by our authentication
      provider (Supabase Auth) to keep you signed in and to protect authenticated pages.
      Without these cookies, you would not be able to log in or stay logged in.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">What We Don&apos;t Use</h2>
      <p>We do not use advertising cookies, analytics cookies, or third-party tracking
      cookies.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Managing Cookies</h2>
      <p>Because the cookies we use are strictly necessary for the service to function,
      they cannot be disabled while remaining signed in. You can clear cookies via your
      browser settings at any time, which will sign you out.</p>
    </div>
  )
}
