'use client'

import Sidebar from '@/components/layouts/Sidebar'
import { LayoutDashboard, Calendar, FileText } from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Events', href: '/admin/events', icon: Calendar },
  { name: 'Templates', href: '/admin/templates', icon: FileText },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar items={navItems} title="Event Platform" subtitle="Admin" />
      <div className="flex-1">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

