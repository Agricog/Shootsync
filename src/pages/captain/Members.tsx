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

interface Member {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  status: string
  subscriptionStatus: string
  insuranceExpiry?: string
}

export default function Members() {
  const { user } = useAuth()
  const syndicateApi = useApi<Syndicate>('syndicates')
  const [syndicateId, setSyndicateId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteData, setInviteData] = useState({ name: '', email: '', phone: '', role: 'GUN' })
  const [inviting, setInviting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  const memberApi = useApi<Member>('members')

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
      const memberData = await memberApi.fetchAll({ syndicateId: syndicates[0].id })
      setMembers(memberData)
    }
    setLoading(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!syndicateId) return

    setInviting(true)
    const result = await memberApi.create({
      ...inviteData,
      syndicateId,
      clerkUserId: `pending_${Date.now()}`,
    } as any)

    if (result) {
      setMembers([...members, result])
      setInviteData({ name: '', email: '', phone: '', role: 'GUN' })
      setShowInviteForm(false)
    }
    setInviting(false)
  }

  const handleStatusChange = async (memberId: string, newStatus: 'ACTIVE' | 'PENDING' | 'INACTIVE') => {
    setUpdatingStatus(memberId)
    try {
      const response = await fetch(`/api/members/${memberId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const updatedMember = await response.json()
        setMembers(members.map(m => m.id === memberId ? updatedMember : m))
      }
    } catch (error) {
      console.error('Failed to update member status:', error)
    }
    setUpdatingStatus(null)
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member? They will be marked as inactive.')) {
      return
    }
    await handleStatusChange(memberId, 'INACTIVE')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'INACTIVE': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'CAPTAIN': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'GUN': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'BEATER': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'HYBRID': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  // Count members by status
  const activeCount = members.filter(m => m.status === 'ACTIVE').length
  const pendingCount = members.filter(m => m.status === 'PENDING').length
  const inactiveCount = members.filter(m => m.status === 'INACTIVE').length

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
        <title>Members | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Members</h1>
            <p className="text-gray-400 text-sm mt-1">
              {activeCount} active · {pendingCount} pending · {inactiveCount} inactive
            </p>
          </div>
          <Button onClick={() => setShowInviteForm(true)}>Invite Member</Button>
        </div>

        {/* Invite Form Modal */}
        {showInviteForm && (
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Invite New Member</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <Input
                label="Name"
                value={inviteData.name}
                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                required
              />
              <Input
                label="Phone"
                value={inviteData.phone}
                onChange={(e) => setInviteData({ ...inviteData, phone: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="GUN">Gun</option>
                  <option value="BEATER">Beater</option>
                  <option value="HYBRID">Hybrid (Gun & Beater)</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={inviting}>
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowInviteForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Members List */}
        {members.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No members yet. Invite your first member to get started.</p>
              <Button onClick={() => setShowInviteForm(true)}>Invite Your First Member</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <Card key={member.id} hover>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{member.name}</h3>
                    <p className="text-gray-300">{member.email}</p>
                    {member.phone && <p className="text-gray-400 text-sm">{member.phone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {updatingStatus === member.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          {member.status === 'PENDING' && (
                            <button
                              onClick={() => handleStatusChange(member.id, 'ACTIVE')}
                              className="text-sm text-green-400 hover:text-green-300 font-medium"
                            >
                              Activate
                            </button>
                          )}
                          {member.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleStatusChange(member.id, 'INACTIVE')}
                              className="text-sm text-amber-400 hover:text-amber-300 font-medium"
                            >
                              Deactivate
                            </button>
                          )}
                          {member.status === 'INACTIVE' && (
                            <button
                              onClick={() => handleStatusChange(member.id, 'ACTIVE')}
                              className="text-sm text-green-400 hover:text-green-300 font-medium"
                            >
                              Reactivate
                            </button>
                          )}
                          {member.status !== 'INACTIVE' && (
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-sm text-red-400 hover:text-red-300 font-medium ml-2"
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
