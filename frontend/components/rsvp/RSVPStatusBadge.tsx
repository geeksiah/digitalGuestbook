'use client'

import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RSVPStatusBadgeProps {
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  className?: string
}

export default function RSVPStatusBadge({ status, className }: RSVPStatusBadgeProps) {
  const config = {
    PENDING: {
      icon: Clock,
      label: 'Pending',
      styles: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    },
    APPROVED: {
      icon: CheckCircle,
      label: 'Approved',
      styles: 'bg-green-100 text-green-800 border-green-200'
    },
    REJECTED: {
      icon: XCircle,
      label: 'Rejected',
      styles: 'bg-red-100 text-red-800 border-red-200'
    }
  }

  const { icon: Icon, label, styles } = config[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border',
        styles,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

