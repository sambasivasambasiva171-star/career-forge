export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <span className="font-semibold">Career Forge</span>
      </header>
      <main className="px-4">{children}</main>
    </div>
  )
}
