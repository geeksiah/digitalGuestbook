'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<any>
}

interface ResponsiveSidebarProps {
  items: SidebarItem[]
  title: string
  subtitle?: string
  isOpen: boolean
  onToggle: () => void
}

export default function ResponsiveSidebar({ items, title, subtitle, isOpen, onToggle }: ResponsiveSidebarProps) {
  const pathname = usePathname()

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isOpen ? 256 : 80 }}
        className="bg-white border-r border-gray-200 flex flex-col transition-all duration-300"
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="font-semibold text-gray-900">{title}</h2>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </motion.div>
          )}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-medium"
                  >
                    {item.name}
                  </motion.span>
                )}
              </Link>
            )
          })}
        </nav>
      </motion.aside>
    </>
  )
}

