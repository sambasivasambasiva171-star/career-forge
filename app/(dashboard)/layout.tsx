import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/onboarding" className="font-semibold text-blue-600">Career Forge</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">Dashboard</Link>
          <Link href="/upload" className="text-gray-600 hover:text-blue-600">Upload</Link>
          <Link href="/review" className="text-gray-600 hover:text-blue-600">Review</Link>
          <Link href="/account" className="text-gray-600 hover:text-blue-600">Account</Link>
          <SignOutButton />
        </nav>
      </header>
      <main className="px-4">{children}</main>
    </div>
  )
}
