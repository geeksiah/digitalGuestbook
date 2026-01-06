'use client'

import Sidebar from '@/components/layouts/Sidebar'
import { LayoutDashboard, Users, Image, MessageSquare } from 'lucide-react'

const navItems = [
  { name: 'Overview', href: '/couple', icon: LayoutDashboard },
  { name: 'RSVPs', href: '/couple', icon: Users },
  { name: 'Media', href: '/couple', icon: Image },
  { name: 'Messages', href: '/couple', icon: MessageSquare },
]

export default function CoupleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar items={navItems} title="Couple Portal" />
      <div className="flex-1">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

