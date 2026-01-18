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
  defaultBeaterRate: number
}

interface Beater {
  id: string
  name: string
  email?: string
  phone?: string
  dayRate: number
  status: string
  bankName?: string
  bankSortCode?: string
  bankAccountNumber?: string
  notes?: string
}

export default function Beaters() {
  const { user } = useAuth()
  const syndicateApi = useApi<Syndicate>('syndicates')
  const [syndicateId, setSyndicateId] = useState<string | null>(null)
  const [defaultRate, setDefaultRate] = useState(40)
  const [beaters, setBeaters] = useState<Beater[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [adding, setAdding] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dayRate: 40,
    bankName: '',
    bankSortCode: '',
    bankAccountNumber: '',
    notes: '',
  })

  const beaterApi = useApi<Beater>('beaters')

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user?.id])

  const loadData = async () => {
    setLoading(true)
    const syndicates = await syndicateApi.fetchAll({ captainClerkId: user?.id || '' })
    if (syndicates.length > 0) {
      setSyndicateId(syndicates[0].id)
      setDefaultRate(syndicates[0].defaultBeaterRate || 40)
      setFormData(prev => ({ ...prev, dayRate: syndicates[0].defaultBeaterRate || 40 }))
      const beaterData = await beaterApi.fetchAll({ syndicateId: syndicates[0].id })
      setBeaters(beaterData)
    }
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!syndicateId) return

    setAdding(true)
    const result = await beaterApi.create({
      ...formData,
      syndicateId,
    } as any)

    if (result) {
      setBeaters([...beaters, result])
      setFormData({
        name: '',
        email: '',
        phone: '',
        dayRate: defaultRate,
        bankName: '',
        bankSortCode: '',
        bankAccountNumber: '',
        notes: '',
      })
      setShowAddForm(false)
    }
    setAdding(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'INACTIVE': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

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
        <title>Beaters | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Beaters</h1>
          <Button onClick={() => setShowAddForm(true)}>Add Beater</Button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card>
            <h2 className="text-lg font-semibold text-green-500 mb-4">Add New Beater</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Day Rate (£)"
                  name="dayRate"
                  type="number"
                  value={formData.dayRate}
                  onChange={handleChange}
                  min={0}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                />
                <Input
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <h3 className="text-md font-semibold text-amber-500 mt-6">Bank Details (for payments)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Bank Name"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                />
                <Input
                  label="Sort Code"
                  name="bankSortCode"
                  value={formData.bankSortCode}
                  onChange={handleChange}
                  placeholder="00-00-00"
                />
                <Input
                  label="Account Number"
                  name="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-amber-500 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={adding}>
                  {adding ? 'Adding...' : 'Add Beater'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Beaters List */}
        {beaters.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-white mb-4">No beaters added yet.</p>
              <Button onClick={() => setShowAddForm(true)}>Add Your First Beater</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {beaters.map((beater) => (
              <Card key={beater.id} hover>
                <div className="flex justify-between items-start">
                  <div>
                    <div>
  <h3 className="text-lg font-semibold text-gray-900">{beater.name}</h3>
  <p className="text-amber-600">£{beater.dayRate}/day</p>
  {beater.phone && <p className="text-gray-700 text-sm mt-1">{beater.phone}</p>}
  {beater.email && <p className="text-gray-700 text-sm">{beater.email}</p>}
</div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(beater.status)}`}>
                      {beater.status}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
