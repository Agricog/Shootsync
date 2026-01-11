/**
 * Peg Allocator Component - ShootSync
 * Generate and display peg allocations
 */

import { useState, useMemo } from 'react'
import Button from '../common/Button'
import Card, { CardHeader, CardContent, CardFooter } from '../common/Card'
import {
  generateFairPegAllocation,
  generateRandomAllocation,
  calculateFairnessScore,
} from '../../utils/pegAlgorithm'

interface Member {
  id: string
  name: string
}

interface PegHistory {
  memberId: string
  pegNumber: number
  shootDate: string
}

interface Allocation {
  memberId: string
  memberName: string
  pegNumber: number
}

interface PegAllocatorProps {
  members: Member[]
  history: PegHistory[]
  numberOfPegs: number
  onSave: (allocations: Allocation[]) => Promise<void>
}

export default function PegAllocator({
  members,
  history,
  numberOfPegs,
  onSave,
}: PegAllocatorProps) {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [method, setMethod] = useState<'fair' | 'random'>('fair')
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)

  const fairnessScore = useMemo(() => {
    return calculateFairnessScore(members, history)
  }, [members, history])

  const handleGenerate = () => {
    const newAllocations =
      method === 'fair'
        ? generateFairPegAllocation(members, history, numberOfPegs)
        : generateRandomAllocation(members, numberOfPegs)

    setAllocations(newAllocations)
    setIsGenerated(true)
  }

  const handleRegenerate = () => {
    handleGenerate()
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(allocations)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSwap = (index1: number, index2: number) => {
    const newAllocations = [...allocations]
    const temp = newAllocations[index1].pegNumber
    newAllocations[index1].pegNumber = newAllocations[index2].pegNumber
    newAllocations[index2].pegNumber = temp
    setAllocations(newAllocations.sort((a, b) => a.pegNumber - b.pegNumber))
  }

  return (
    <Card>
      <CardHeader
        title="Peg Allocation"
        subtitle={`${members.length} guns, ${numberOfPegs} pegs`}
      />
      <CardContent>
        <div className="space-y-6">
          {/* Method Selection */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="method"
                value="fair"
                checked={method === 'fair'}
                onChange={() => setMethod('fair')}
                className="w-4 h-4 text-green-600 bg-slate-700 border-slate-600 focus:ring-green-500"
              />
              <span className="text-white">Fair Rotation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="method"
                value="random"
                checked={method === 'random'}
                onChange={() => setMethod('random')}
                className="w-4 h-4 text-green-600 bg-slate-700 border-slate-600 focus:ring-green-500"
              />
              <span className="text-white">Random</span>
            </label>
          </div>

          {/* Fairness Score */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Season Fairness Score</p>
                <p className="text-xs text-slate-500 mt-1">
                  Based on historical peg distribution
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-2xl font-bold ${
                    fairnessScore >= 80
                      ? 'text-green-500'
                      : fairnessScore >= 60
                      ? 'text-amber-500'
                      : 'text-red-500'
                  }`}
                >
                  {fairnessScore}%
                </span>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          {!isGenerated && (
            <Button onClick={handleGenerate} fullWidth>
              Generate Allocation
            </Button>
          )}

          {/* Allocations Display */}
          {isGenerated && allocations.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Allocation</h3>
                <Button variant="secondary" size="sm" onClick={handleRegenerate}>
                  Regenerate
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {allocations.map((allocation, index) => (
                  <PegCard
                    key={allocation.memberId}
                    allocation={allocation}
                    index={index}
                    onSwap={handleSwap}
                    totalAllocations={allocations.length}
                  />
                ))}
              </div>

              <p className="text-slate-500 text-sm text-center">
                Click two pegs to swap them
              </p>
            </div>
          )}

          {isGenerated && allocations.length === 0 && (
            <p className="text-slate-400 text-center py-4">
              No members available for allocation
            </p>
          )}
        </div>
      </CardContent>

      {isGenerated && allocations.length > 0 && (
        <CardFooter>
          <Button onClick={handleSave} isLoading={isSaving}>
            Save Allocation
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

interface PegCardProps {
  allocation: Allocation
  index: number
  onSwap: (index1: number, index2: number) => void
  totalAllocations: number
}

let selectedIndex: number | null = null

function PegCard({ allocation, index, onSwap }: PegCardProps) {
  const [isSelected, setIsSelected] = useState(false)

  const handleClick = () => {
    if (selectedIndex === null) {
      selectedIndex = index
      setIsSelected(true)
    } else if (selectedIndex === index) {
      selectedIndex = null
      setIsSelected(false)
    } else {
      onSwap(selectedIndex, index)
      selectedIndex = null
      setIsSelected(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`
        p-3 rounded-lg border text-center transition-all
        ${
          isSelected
            ? 'border-green-500 bg-green-500/10'
            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
        }
      `}
    >
      <div
        className={`
          w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg font-bold mb-2
          ${isSelected ? 'bg-green-600 text-white' : 'bg-slate-700 text-white'}
        `}
      >
        {allocation.pegNumber}
      </div>
      <p className="text-white text-sm font-medium truncate">
        {allocation.memberName.split(' ')[0]}
      </p>
    </button>
  )
}
