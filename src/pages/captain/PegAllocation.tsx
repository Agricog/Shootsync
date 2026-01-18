import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface Syndicate {
  id: string
  name: string
  pegRotationRule: string
}

interface ShootDay {
  id: string
  date: string
  locationName: string
  status: string
  drivesPlanned: number
}

interface Member {
  id: string
  name: string
  role: string
  status: string
}

interface Attendance {
  id: string
  memberId: string
  pegNumber: number | null
  member?: Member
}

interface PegHistory {
  memberId: string
  pegNumber: number
  shootDate: string
}

export default function PegAllocation() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const shootIdParam = searchParams.get('shootId')

  const syndicateApi = useApi<Syndicate>('syndicates')
  const shootApi = useApi<ShootDay>('shoots')
  const memberApi = useApi<Member>('members')

  const [syndicateId, setSyndicateId] = useState<string | null>(null)
  const [shoots, setShoots] = useState<ShootDay[]>([])
  const [selectedShoot, setSelectedShoot] = useState<string | null>(shootIdParam)
  const [members, setMembers] = useState<Member[]>([])
  const [allocations, setAllocations] = useState<{ memberId: string; memberName: string; pegNumber: number }[]>([])
  const [pegHistory, setPegHistory] = useState<PegHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [numberOfPegs, setNumberOfPegs] = useState(10)

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
      const [shootData, memberData] = await Promise.all([
        shootApi.fetchAll({ syndicateId: syndicates[0].id }),
        memberApi.fetchAll({ syndicateId: syndicates[0].id, status: 'ACTIVE' }),
      ])
      setShoots(shootData.filter(s => s.status === 'SCHEDULED'))
      setMembers(memberData.filter(m => m.role === 'GUN' || m.role === 'CAPTAIN' || m.role === 'HYBRID'))
      
      if (shootIdParam) {
        setSelectedShoot(shootIdParam)
      }
    }
    setLoading(false)
  }

  const generateFairAllocation = () => {
    setGenerating(true)
    
    const gunsToAllocate = members.filter(m => m.status === 'ACTIVE')
    
    if (gunsToAllocate.length === 0) {
      alert('No active members to allocate pegs to')
      setGenerating(false)
      return
    }

    // Count how many times each member has had each peg
    const pegCounts: Record<string, Record<number, number>> = {}
    
    gunsToAllocate.forEach(m => {
      pegCounts[m.id] = {}
      for (let p = 1; p <= numberOfPegs; p++) {
        pegCounts[m.id][p] = 0
      }
    })

    // Add history counts
    pegHistory.forEach(h => {
      if (pegCounts[h.memberId] && pegCounts[h.memberId][h.pegNumber] !== undefined) {
        pegCounts[h.memberId][h.pegNumber]++
      }
    })

    // Assign pegs to minimize repetition
    const newAllocations: { memberId: string; memberName: string; pegNumber: number }[] = []
    const assignedPegs = new Set<number>()

    // Sort members by total shoots attended (ascending) for fairness
    const sortedMembers = [...gunsToAllocate].sort((a, b) => {
      const aTotal = Object.values(pegCounts[a.id] || {}).reduce((sum, c) => sum + c, 0)
      const bTotal = Object.values(pegCounts[b.id] || {}).reduce((sum, c) => sum + c, 0)
      return aTotal - bTotal
    })

    sortedMembers.forEach(member => {
      let bestPeg = 1
      let lowestCount = Infinity

      for (let p = 1; p <= numberOfPegs; p++) {
        if (!assignedPegs.has(p) && pegCounts[member.id]) {
          const count = pegCounts[member.id][p] || 0
          if (count < lowestCount) {
            lowestCount = count
            bestPeg = p
          }
        }
      }

      // If all pegs taken, find first available
      if (assignedPegs.has(bestPeg)) {
        for (let p = 1; p <= numberOfPegs; p++) {
          if (!assignedPegs.has(p)) {
            bestPeg = p
            break
          }
        }
      }

      newAllocations.push({
        memberId: member.id,
        memberName: member.name,
        pegNumber: bestPeg,
      })

      assignedPegs.add(bestPeg)
    })

    // Sort by peg number for display
    newAllocations.sort((a, b) => a.pegNumber - b.pegNumber)
    setAllocations(newAllocations)
    setGenerating(false)
  }

  const generateRandomAllocation = () => {
    setGenerating(true)
    
    const gunsToAllocate = members.filter(m => m.status === 'ACTIVE')
    
    if (gunsToAllocate.length === 0) {
      alert('No active members to allocate pegs to')
      setGenerating(false)
      return
    }

    // Shuffle members randomly
    const shuffled = [...gunsToAllocate].sort(() => Math.random() - 0.5)
    
    const newAllocations = shuffled.map((member, index) => ({
      memberId: member.id,
      memberName: member.name,
      pegNumber: index + 1,
    }))

    newAllocations.sort((a, b) => a.pegNumber - b.pegNumber)
    setAllocations(newAllocations)
    setGenerating(false)
  }

  const saveAllocations = async () => {
    if (!selectedShoot || allocations.length === 0) return

    setSaving(true)
    
    // Save each allocation to shoot attendance
    for (const alloc of allocations) {
      await fetch(`/api/shoots/${selectedShoot}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: alloc.memberId,
          pegNumber: alloc.pegNumber,
          confirmed: true,
        }),
      })
    }

    setSaving(false)
    alert('Peg allocations saved!')
  }

  const movePegUp = (index: number) => {
    if (index === 0) return
    const newAllocations = [...allocations]
    const currentPeg = newAllocations[index].pegNumber
    const prevPeg = newAllocations[index - 1].pegNumber
    newAllocations[index].pegNumber = prevPeg
    newAllocations[index - 1].pegNumber = currentPeg
    newAllocations.sort((a, b) => a.pegNumber - b.pegNumber)
    setAllocations(newAllocations)
  }

  const movePegDown = (index: number) => {
    if (index === allocations.length - 1) return
    const newAllocations = [...allocations]
    const currentPeg = newAllocations[index].pegNumber
    const nextPeg = newAllocations[index + 1].pegNumber
    newAllocations[index].pegNumber = nextPeg
    newAllocations[index + 1].pegNumber = currentPeg
    newAllocations.sort((a, b) => a.pegNumber - b.pegNumber)
    setAllocations(newAllocations)
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
        <title>Peg Allocation | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Peg Allocation</h1>

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
                {shoot.locationName} - {new Date(shoot.date).toLocaleDateString('en-GB')}
              </option>
            ))}
          </select>
        </Card>

        {selectedShoot && (
          <>
            {/* Settings */}
            <Card>
              <h2 className="text-lg font-semibold text-green-600 mb-4">Settings</h2>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Pegs</label>
                  <input
                    type="number"
                    value={numberOfPegs}
                    onChange={(e) => setNumberOfPegs(parseInt(e.target.value) || 10)}
                    min={1}
                    max={20}
                    className="w-24 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900"
                  />
                </div>
                <div className="flex gap-2 mt-6">
                  <Button onClick={generateFairAllocation} disabled={generating}>
                    {generating ? 'Generating...' : 'Fair Rotation'}
                  </Button>
                  <Button variant="secondary" onClick={generateRandomAllocation} disabled={generating}>
                    Random Draw
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Fair Rotation:</strong> Assigns pegs based on history - members get pegs they've had least often.
                <br />
                <strong>Random Draw:</strong> Completely random peg assignment.
              </p>
            </Card>

            {/* Members */}
            <Card>
              <h2 className="text-lg font-semibold text-green-600 mb-4">
                Guns to Allocate ({members.length})
              </h2>
              {members.length === 0 ? (
                <p className="text-gray-700">No active gun members. Add members first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {members.map((member) => (
                    <span
                      key={member.id}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {member.name}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Allocations */}
            {allocations.length > 0 && (
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-green-600">Peg Allocations</h2>
                  <Button onClick={saveAllocations} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Allocations'}
                  </Button>
                </div>
                <div className="space-y-2">
                  {allocations.map((alloc, index) => (
                    <div
                      key={alloc.memberId}
                      className="flex justify-between items-center p-3 bg-gray-100 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-12 h-12 flex items-center justify-center bg-green-600 text-white rounded-full font-bold text-lg">
                          {alloc.pegNumber}
                        </span>
                        <span className="font-medium text-gray-900">{alloc.memberName}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => movePegUp(index)}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => movePegDown(index)}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                          disabled={index === allocations.length - 1}
                        >
                          ↓
                        </button>
                      </div>
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
