'use client'

import { Filter } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface MediaFilterControlsProps {
  typeFilter: 'ALL' | 'VIDEO' | 'AUDIO' | 'PHOTO'
  sourceFilter: 'ALL' | 'PERSONAL' | 'BOOTH'
  onTypeFilterChange: (filter: 'ALL' | 'VIDEO' | 'AUDIO' | 'PHOTO') => void
  onSourceFilterChange: (filter: 'ALL' | 'PERSONAL' | 'BOOTH') => void
}

export default function MediaFilterControls({
  typeFilter,
  sourceFilter,
  onTypeFilterChange,
  onSourceFilterChange
}: MediaFilterControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-500" />
        <Label className="text-sm font-medium text-gray-700">Filters:</Label>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-sm text-gray-600">Type:</Label>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value as any)}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
        >
          <option value="ALL">All</option>
          <option value="VIDEO">Video</option>
          <option value="AUDIO">Audio</option>
          <option value="PHOTO">Photo</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-sm text-gray-600">Source:</Label>
        <select
          value={sourceFilter}
          onChange={(e) => onSourceFilterChange(e.target.value as any)}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
        >
          <option value="ALL">All</option>
          <option value="PERSONAL">Personal</option>
          <option value="BOOTH">Booth</option>
        </select>
      </div>
    </div>
  )
}

