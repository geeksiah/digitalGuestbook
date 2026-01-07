'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Download } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import RSVPStatusBadge from './RSVPStatusBadge'
import ApprovalActionModal from './ApprovalActionModal'
import LoadingState from '@/components/dashboard/LoadingState'
import EmptyState from '@/components/dashboard/EmptyState'
import { Users } from 'lucide-react'

interface RSVP {
  id: string
  partyName: string
  response: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  guestCount: number | null
  contactEmail: string | null
  contactPhone: string | null
  createdAt: string
}

interface RSVPApprovalTableProps {
  rsvps: RSVP[]
  loading?: boolean
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  onDownloadInvitation?: (id: string) => void
}

export default function RSVPApprovalTable({
  rsvps,
  loading,
  onApprove,
  onReject,
  onDownloadInvitation
}: RSVPApprovalTableProps) {
  const [selectedRSVP, setSelectedRSVP] = useState<RSVP | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)

  if (loading) {
    return <LoadingState message="Loading RSVPs..." />
  }

  if (rsvps.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No RSVPs yet"
        description="RSVP submissions will appear here"
      />
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Guests</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rsvps.map((rsvp, index) => (
              <motion.tr
                key={rsvp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-b hover:bg-gray-50"
              >
                <TableCell className="font-medium">{rsvp.partyName}</TableCell>
                <TableCell>{rsvp.response}</TableCell>
                <TableCell>{rsvp.guestCount || '-'}</TableCell>
                <TableCell>
                  <RSVPStatusBadge status={rsvp.status} />
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {rsvp.contactEmail || rsvp.contactPhone || '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {rsvp.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRSVP(rsvp)
                            setActionType('approve')
                          }}
                          className="text-green-700 border-green-300 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRSVP(rsvp)
                            setActionType('reject')
                          }}
                          className="text-red-700 border-red-300 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {rsvp.status === 'APPROVED' && onDownloadInvitation && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDownloadInvitation(rsvp.id)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Invitation
                      </Button>
                    )}
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedRSVP && actionType && (
        <ApprovalActionModal
          rsvp={selectedRSVP}
          action={actionType}
          onConfirm={async () => {
            if (actionType === 'approve') {
              await onApprove(selectedRSVP.id)
            } else {
              await onReject(selectedRSVP.id)
            }
            setSelectedRSVP(null)
            setActionType(null)
          }}
          onCancel={() => {
            setSelectedRSVP(null)
            setActionType(null)
          }}
        />
      )}
    </>
  )
}

