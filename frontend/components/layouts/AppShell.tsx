'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import ResponsiveSidebar from './ResponsiveSidebar'
import PageHeader from './PageHeader'

interface AppShellProps {
  children: React.ReactNode
  sidebarItems: Array<{ name: string; href: string; icon: React.ComponentType<any> }>
  title: string
  subtitle?: string
  headerActions?: React.ReactNode
}

export default function AppShell({ children, sidebarItems, title, subtitle, headerActions }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <ResponsiveSidebar
        items={sidebarItems}
        title={title}
        subtitle={subtitle}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <PageHeader title={title} subtitle={subtitle} actions={headerActions} />
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

