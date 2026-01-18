import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface Syndicate {
  id: string
  name: string
}

interface ShootDay {
  id: string
  date: string
  locationName: string
  status: string
}

interface BagRecord {
  id: string
  driveNumber: number
  pheasant: number
  partridge: number
  duck: number
  woodcock: number
  other: number
  otherDescription?: string
  notes?: string
}

export default function BagRecord() {
  const { user } = useAuth()
  const syndicateApi = useApi<Syndicate>('syndicates')
  const shootApi = useApi<ShootDay>('shoots')
  const bagApi = useApi<BagRecord>('bags')

  const [syndicateId, setSyndicateId] = useState<string | null>(null)
  const [shoots, setShoots] = useState<ShootDay[]>([])
  const [selectedShoot, setSelectedShoot] = useState<string | null>(null)
  const [bags, setBags] = useState<BagRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  const [formData, setFormData] = useState({
    driveNumber: 1,
    pheasant: 0,
    partridge: 0,
    duck: 0,
    woodcock: 0,
    other: 0,
    otherDescription: '',
    notes: '',
  })

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user?.id])

  useEffect(() => {
    if (selectedShoot) {
      loadBags()
    }
  }, [selectedShoot])

  const loadData = async () => {
    setLoading(true)
    const syndicates = await syndicateApi.fetchAll({ captainClerkId: user?.id || '' })
    if (syndicates.length > 0) {
      setSyndicateId(syndicates[0].id)
      const shootData = await shootApi.fetchAll({ syndicateId: syndicates[0].id })
      setShoots(shootData)
      // Auto-select most recent scheduled shoot
      const scheduled = shootData.filter(s => s.status === 'SCHEDULED')
      if (scheduled.length > 0) {
        setSelectedShoot(scheduled[0].id)
      }
    }
    setLoading(false)
  }

  const loadBags = async () => {
    if (!selectedShoot) return
    const bagData = await bagApi.fetchAll({ shootId: selectedShoot })
    setBags(bagData)
    // Set next drive number
    const maxDrive = bagData.reduce((max, b) => Math.max(max, b.driveNumber), 0)
    setFormData(prev => ({ ...prev, driveNumber: maxDrive + 1 }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShoot || !syndicateId) return

    setSaving(true)
    const result = await bagApi.create({
  ...formData,
  shootId: selectedShoot,
} as any)

    if (result) {
      setBags([...bags, result])
      setFormData({
        driveNumber: formData.driveNumber + 1,
        pheasant: 0,
        partridge: 0,
        duck: 0,
        woodcock: 0,
        other: 0,
        otherDescription: '',
        notes: '',
      })
    }
    setSaving(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  // Voice input for hands-free recording
  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Try Chrome.')
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

    recognition.onerror = () => setIsListening(false)
    recognition.start()
  }

  const parseVoiceInput = (text: string) => {
    // Parse: "34 pheasant 12 partridge 5 duck"
    const pheasantMatch = text.match(/(\d+)\s*pheasant/)
    const partridgeMatch = text.match(/(\d+)\s*partridge/)
    const duckMatch = text.match(/(\d+)\s*duck/)
    const woodcockMatch = text.match(/(\d+)\s*woodcock/)
    const otherMatch = text.match(/(\d+)\s*other/)

    setFormData(prev => ({
      ...prev,
      pheasant: pheasantMatch ? parseInt(pheasantMatch[1]) : prev.pheasant,
      partridge: partridgeMatch ? parseInt(partridgeMatch[1]) : prev.partridge,
      duck: duckMatch ? parseInt(duckMatch[1]) : prev.duck,
      woodcock: woodcockMatch ? parseInt(woodcockMatch[1]) : prev.woodcock,
      other: otherMatch ? parseInt(otherMatch[1]) : prev.other,
    }))
  }

  // Calculate totals
  const totals = bags.reduce(
    (acc, bag) => ({
      pheasant: acc.pheasant + bag.pheasant,
      partridge: acc.partridge + bag.partridge,
      duck: acc.duck + bag.duck,
      woodcock: acc.woodcock + bag.woodcock,
      other: acc.other + bag.other,
    }),
    { pheasant: 0, partridge: 0, duck: 0, woodcock: 0, other: 0 }
  )

  const totalBirds = totals.pheasant + totals.partridge + totals.duck + totals.woodcock + totals.other

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Record Bag | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Record Bag</h1>

        {/* Shoot Selector */}
        <Card>
          <label className="block text-sm font-medium text-gray-900 mb-2">Select Shoot Day</label>
          <select
            value={selectedShoot || ''}
            onChange={(e) => setSelectedShoot(e.target.value)}
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">-- Select a shoot --</option>
            {shoots.map((shoot) => (
              <option key={shoot.id} value={shoot.id}>
                {shoot.locationName} - {new Date(shoot.date).toLocaleDateString('en-GB')} ({shoot.status})
              </option>
            ))}
          </select>
        </Card>

        {selectedShoot && (
          <>
            {/* Running Totals */}
            <Card>
              <h2 className="text-lg font-semibold text-green-600 mb-4">Running Total: {totalBirds} birds</h2>
              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.pheasant}</p>
                  <p className="text-amber-600 text-sm">Pheasant</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.partridge}</p>
                  <p className="text-amber-600 text-sm">Partridge</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.duck}</p>
                  <p className="text-amber-600 text-sm">Duck</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.woodcock}</p>
                  <p className="text-amber-600 text-sm">Woodcock</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.other}</p>
                  <p className="text-amber-600 text-sm">Other</p>
                </div>
              </div>
            </Card>

            {/* Record Form */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-green-600">Drive {formData.driveNumber}</h2>
                <Button
                  type="button"
                  variant={isListening ? 'primary' : 'secondary'}
                  onClick={startVoiceInput}
                >
                  {isListening ? '🎤 Listening...' : '🎤 Voice Input'}
                </Button>
              </div>

              {transcript && (
                <p className="text-sm text-gray-600 mb-4 italic">Heard: "{transcript}"</p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Input
                    label="Pheasant"
                    name="pheasant"
                    type="number"
                    value={formData.pheasant}
                    onChange={handleChange}
                    min={0}
                  />
                  <Input
                    label="Partridge"
                    name="partridge"
                    type="number"
                    value={formData.partridge}
                    onChange={handleChange}
                    min={0}
                  />
                  <Input
                    label="Duck"
                    name="duck"
                    type="number"
                    value={formData.duck}
                    onChange={handleChange}
                    min={0}
                  />
                  <Input
                    label="Woodcock"
                    name="woodcock"
                    type="number"
                    value={formData.woodcock}
                    onChange={handleChange}
                    min={0}
                  />
                  <Input
                    label="Other"
                    name="other"
                    type="number"
                    value={formData.other}
                    onChange={handleChange}
                    min={0}
                  />
                </div>

                {formData.other > 0 && (
                  <Input
                    label="Other Description"
                    name="otherDescription"
                    value={formData.otherDescription}
                    onChange={handleChange}
                    placeholder="e.g. Pigeon, Rabbit"
                  />
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900"
                    placeholder="Optional notes for this drive..."
                  />
                </div>

                <Button type="submit" disabled={saving} size="lg" className="w-full">
                  {saving ? 'Saving...' : `Save Drive ${formData.driveNumber}`}
                </Button>
              </form>
            </Card>

            {/* Previous Drives */}
            {bags.length > 0 && (
              <Card>
                <h2 className="text-lg font-semibold text-green-600 mb-4">Recorded Drives</h2>
                <div className="space-y-2">
                  {bags.sort((a, b) => a.driveNumber - b.driveNumber).map((bag) => (
                    <div key={bag.id} className="flex justify-between items-center p-3 bg-gray-100 rounded-lg">
                      <span className="font-medium text-gray-900">Drive {bag.driveNumber}</span>
                      <span className="text-gray-700">
                        {bag.pheasant}P {bag.partridge}Pa {bag.duck}D {bag.woodcock}W {bag.other}O
                      </span>
                      <span className="font-semibold text-green-600">
                        {bag.pheasant + bag.partridge + bag.duck + bag.woodcock + bag.other} total
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
