'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { QrCode, Keypad } from 'lucide-react'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ManualCodeInput from '@/components/checkin/ManualCodeInput'
import CheckInResultToast from '@/components/checkin/CheckInResultToast'

export default function CheckInPage() {
  const params = useParams()
  const eventSlug = params.eventSlug as string
  const [deviceKey, setDeviceKey] = useState('')
  const [mode, setMode] = useState<'scan' | 'code'>('code')
  const [code, setCode] = useState('')
  const [qrData, setQrData] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'warning', text: string, partyName?: string } | null>(null)

  async function handleCheckIn() {
    if (!deviceKey) {
      setResult({ type: 'error', text: 'Please enter device key' })
      return
    }

    if (mode === 'code' && code.length !== 6) {
      setResult({ type: 'error', text: 'Please enter 6-digit code' })
      return
    }

    if (mode === 'scan' && !qrData) {
      setResult({ type: 'error', text: 'Please scan QR code' })
      return
    }

    setChecking(true)
    setResult(null)

    try {
      const data = await apiPost<{ result: string; partyName?: string }>(
        mode === 'scan' ? '/v1/checkin/scan' : '/v1/checkin/code',
        mode === 'scan' ? { qrPayload: qrData, eventSlug } : { code, eventSlug },
        { 'x-device-key': deviceKey }
      )

      if (data.result === 'SUCCESS') {
        setResult({ type: 'success', text: `Checked in successfully`, partyName: data.partyName })
        setCode('')
        setQrData('')
      } else if (data.result === 'DUPLICATE') {
        setResult({ type: 'warning', text: `Already checked in`, partyName: data.partyName })
      } else {
        setResult({ type: 'error', text: data.result })
      }
    } catch (err) {
      setResult({ type: 'error', text: (err as Error).message })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Event Check-In</CardTitle>
          <CardDescription>Verify and check in attendees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="deviceKey">Device Key</Label>
            <Input
              id="deviceKey"
              type="password"
              value={deviceKey}
              onChange={(e) => setDeviceKey(e.target.value)}
              placeholder="Enter device API key"
            />
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as 'scan' | 'code')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="code">
                <Keypad className="h-4 w-4 mr-2" />
                6-Digit Code
              </TabsTrigger>
              <TabsTrigger value="scan">
                <QrCode className="h-4 w-4 mr-2" />
                QR Code
              </TabsTrigger>
            </TabsList>

            <TabsContent value="code" className="space-y-4">
              <ManualCodeInput
                length={6}
                onComplete={(completedCode) => {
                  setCode(completedCode)
                  handleCheckIn()
                }}
                disabled={checking || !deviceKey}
                error={result?.type === 'error' ? result.text : undefined}
              />
            </TabsContent>

            <TabsContent value="scan" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qrData">QR Code Data</Label>
                <Input
                  id="qrData"
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  placeholder="Scan or paste QR code data"
                />
              </div>
            </TabsContent>
          </Tabs>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCheckIn}
            disabled={checking || !deviceKey || (mode === 'code' && code.length !== 6) || (mode === 'scan' && !qrData)}
            className="w-full py-4 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? 'Checking...' : 'Check In'}
          </motion.button>

          {result && (
            <CheckInResultToast
              type={result.type}
              message={result.text}
              partyName={result.partyName}
              onClose={() => setResult(null)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

