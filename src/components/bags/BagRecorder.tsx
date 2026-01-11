/**
 * Bag Recorder Component - ShootSync
 * Record bags with voice input support
 */

import { useState, useCallback } from 'react'
import Button from '../common/Button'
import Input from '../common/Input'
import Card, { CardHeader, CardContent, CardFooter } from '../common/Card'
import { useOffline } from '../../hooks/useOffline'
import { captureError } from '../../utils/errorTracking'

interface BagRecorderProps {
  shootId: string
  shootName: string
  drivesPlanned: number
  onSave: (data: BagData) => Promise<void>
}

interface BagData {
  driveNumber: number
  pheasant: number
  partridge: number
  duck: number
  woodcock: number
  other: number
  otherDescription: string
  notes: string
}

export default function BagRecorder({ shootId, shootName, drivesPlanned, onSave }: BagRecorderProps) {
  const { isOnline, queueOfflineRequest } = useOffline()
  const [currentDrive, setCurrentDrive] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  const [formData, setFormData] = useState<BagData>({
    driveNumber: 1,
    pheasant: 0,
    partridge: 0,
    duck: 0,
    woodcock: 0,
    other: 0,
    otherDescription: '',
    notes: '',
  })

  const handleChange = (field: keyof BagData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const startVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in this browser')
      return
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-GB'

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript.toLowerCase()
      setTranscript(text)
      parseVoiceInput(text)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.start()
  }, [])

  const parseVoiceInput = useCallback((text: string) => {
    const pheasantMatch = text.match(/(\d+)\s*pheasants?/)
    const partridgeMatch = text.match(/(\d+)\s*partridges?/)
    const duckMatch = text.match(/(\d+)\s*ducks?/)
    const woodcockMatch = text.match(/(\d+)\s*woodcocks?/)

    setFormData(prev => ({
      ...prev,
      pheasant: pheasantMatch ? parseInt(pheasantMatch[1]) : prev.pheasant,
      partridge: partridgeMatch ? parseInt(partridgeMatch[1]) : prev.partridge,
      duck: duckMatch ? parseInt(duckMatch[1]) : prev.duck,
      woodcock: woodcockMatch ? parseInt(woodcockMatch[1]) : prev.woodcock,
    }))
  }, [])

  const handleSubmit = async () => {
    setIsSubmitting(true)

    const bagData = {
      ...formData,
      driveNumber: currentDrive,
    }

    try {
      if (isOnline) {
        await onSave(bagData)
      } else {
        await queueOfflineRequest('bag_record', {
          shootId,
          ...bagData,
        })
      }

      // Reset form for next drive
      if (currentDrive < drivesPlanned) {
        setCurrentDrive(prev => prev + 1)
        setFormData({
          driveNumber: currentDrive + 1,
          pheasant: 0,
          partridge: 0,
          duck: 0,
          woodcock: 0,
          other: 0,
          otherDescription: '',
          notes: '',
        })
        setTranscript('')
      }
    } catch (err) {
      captureError(err, 'BagRecorder.handleSubmit')
    } finally {
      setIsSubmitting(false)
    }
  }

  const total = formData.pheasant + formData.partridge + formData.duck + formData.woodcock + formData.other

  return (
    <Card>
      <CardHeader
        title={`Drive ${currentDrive} of ${drivesPlanned}`}
        subtitle={shootName}
      />
      <CardContent>
        <div className="space-y-6">
          {/* Voice Input */}
          <div className="flex items-center gap-4">
            <Button
              variant={isListening ? 'danger' : 'secondary'}
              onClick={startVoiceInput}
              disabled={isListening}
            >
              {isListening ? 'Listening...' : 'Voice Input'}
            </Button>
            {transcript && (
              <p className="text-slate-400 text-sm italic">"{transcript}"</p>
            )}
          </div>

          {/* Manual Input */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Input
              type="number"
              label="Pheasant"
              value={formData.pheasant.toString()}
              onChange={handleChange('pheasant')}
              min="0"
            />
            <Input
              type="number"
              label="Partridge"
              value={formData.partridge.toString()}
              onChange={handleChange('partridge')}
              min="0"
            />
            <Input
              type="number"
              label="Duck"
              value={formData.duck.toString()}
              onChange={handleChange('duck')}
              min="0"
            />
            <Input
              type="number"
              label="Woodcock"
              value={formData.woodcock.toString()}
              onChange={handleChange('woodcock')}
              min="0"
            />
            <Input
              type="number"
              label="Other"
              value={formData.other.toString()}
              onChange={handleChange('other')}
              min="0"
            />
            {formData.other > 0 && (
              <Input
                label="Other Description"
                value={formData.otherDescription}
                onChange={handleChange('otherDescription')}
                placeholder="e.g., Pigeon"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={handleChange('notes')}
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Any notes for this drive..."
            />
          </div>

          {/* Total */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Drive Total</span>
              <span className="text-2xl font-bold text-white">{total}</span>
            </div>
          </div>

          {!isOnline && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-400 text-sm">
                You're offline. Bag will be saved and synced when you reconnect.
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleSubmit}
          isLoading={isSubmitting}
          disabled={total === 0}
        >
          {currentDrive < drivesPlanned ? 'Save & Next Drive' : 'Save & Finish'}
        </Button>
      </CardFooter>
    </Card>
  )
}
