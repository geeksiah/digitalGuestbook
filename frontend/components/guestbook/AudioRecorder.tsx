'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mic, Square, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void
  maxDuration?: number
  disabled?: boolean
}

export default function AudioRecorder({ onRecordingComplete, maxDuration = 180, disabled }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  function updateWaveform() {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((a, b) => a + b) / bufferLength
    setAudioLevel(average / 255)

    animationFrameRef.current = requestAnimationFrame(updateWaveform)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      const analyser = stream.getAudioTracks()[0]?.getSettings()
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 256
      source.connect(analyserNode)
      analyserRef.current = analyserNode

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        onRecordingComplete(blob, duration)
        stream.getTracks().forEach(track => track.stop())
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }

      mediaRecorder.start()
      setRecording(true)
      setDuration(0)
      updateWaveform()

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording()
            return maxDuration
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ scale: recording ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 1, repeat: recording ? Infinity : 0 }}
          className="relative"
        >
          <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
            <Mic className="h-12 w-12 text-gray-600" />
          </div>
          {recording && (
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-red-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.div>

        {recording && (
          <div className="w-full max-w-md">
            <div className="h-20 bg-gray-100 rounded-lg p-4 flex items-center justify-center gap-1">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-gray-900 rounded-full"
                  animate={{
                    height: `${20 + audioLevel * 60 * Math.random()}px`
                  }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-2xl font-mono font-bold text-gray-900">
            {formatTime(duration)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Max: {formatTime(maxDuration)}
          </p>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        {!recording ? (
          <Button
            onClick={startRecording}
            disabled={disabled}
            size="lg"
            className="px-8 py-6 text-lg"
          >
            <Mic className="h-5 w-5 mr-2" />
            Start Recording
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            size="lg"
            className="px-8 py-6 text-lg bg-red-600 hover:bg-red-700"
          >
            <Square className="h-5 w-5 mr-2" />
            Stop Recording
          </Button>
        )}
      </div>
    </div>
  )
}

