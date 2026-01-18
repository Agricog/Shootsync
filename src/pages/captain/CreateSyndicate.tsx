import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'

export default function CreateSyndicate() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { create, loading, error } = useApi('syndicates')
  
  const [formData, setFormData] = useState({
    name: '',
    seasonStart: '',
    seasonEnd: '',
    subscriptionAmount: 800,
    defaultBeaterRate: 40,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.id) return

    const result = await create({
      ...formData,
      captainClerkId: user.id,
    })

    if (result) {
      navigate('/dashboard')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create Your Syndicate</h1>
        
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <Input
              label="Syndicate Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Beatrice Pheasant Syndicate 2025-26"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Season Start"
                name="seasonStart"
                type="date"
                value={formData.seasonStart}
                onChange={handleChange}
                required
              />
              <Input
                label="Season End"
                name="seasonEnd"
                type="date"
                value={formData.seasonEnd}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Annual Subscription (£)"
                name="subscriptionAmount"
                type="number"
                value={formData.subscriptionAmount}
                onChange={handleChange}
                min={0}
              />
              <Input
                label="Default Beater Rate (£)"
                name="defaultBeaterRate"
                type="number"
                value={formData.defaultBeaterRate}
                onChange={handleChange}
                min={0}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Syndicate'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  )
}
