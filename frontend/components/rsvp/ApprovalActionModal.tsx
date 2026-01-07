'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface RSVP {
  id: string
  partyName: string
  response: string
  status: string
}

interface ApprovalActionModalProps {
  rsvp: RSVP
  action: 'approve' | 'reject'
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export default function ApprovalActionModal({ rsvp, action, onConfirm, onCancel }: ApprovalActionModalProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  const isApprove = action === 'approve'

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            {isApprove ? 'Approve RSVP' : 'Reject RSVP'}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Approve RSVP from ${rsvp.partyName}? This will issue an invitation pass.`
              : `Reject RSVP from ${rsvp.partyName}? They will receive a rejection message.`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{rsvp.partyName}</p>
            <p className="text-sm text-gray-500 mt-1">Response: {rsvp.response}</p>
          </div>
          {!isApprove && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                The guest will receive: "Thank you for your response. The event organizers will be in touch."
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {loading ? 'Processing...' : isApprove ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

