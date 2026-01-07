'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Keypad } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ManualCodeInputProps {
  length?: number
  onComplete: (code: string) => void
  disabled?: boolean
  error?: string
}

export default function ManualCodeInput({ length = 6, onComplete, disabled, error }: ManualCodeInputProps) {
  const [code, setCode] = useState<string[]>(Array(length).fill(''))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (code.every(digit => digit !== '') && code.join('').length === length) {
      onComplete(code.join(''))
    }
  }, [code, length, onComplete])

  function handleChange(index: number, value: string) {
    if (disabled) return
    if (!/^\d*$/.test(value)) return // Only digits

    const newCode = [...code]
    newCode[index] = value.slice(-1) // Only last character
    setCode(newCode)

    // Auto-focus next input
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').slice(0, length)
    if (!/^\d+$/.test(pasted)) return

    const newCode = [...code]
    for (let i = 0; i < pasted.length && i < length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2">
        <Keypad className="h-4 w-4" />
        Enter {length}-Digit Code
      </Label>
      <div className="flex gap-2 justify-center">
        {code.map((digit, index) => (
          <motion.input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`
              w-12 h-14 text-center text-2xl font-mono font-bold
              border-2 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-gray-900
              transition-all
              ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            initial={{ scale: 1 }}
            whileFocus={{ scale: 1.05 }}
          />
        ))}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-600 text-center"
        >
          {error}
        </motion.p>
      )}
    </div>
  )
}

