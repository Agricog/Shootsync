/**
 * Bag Record Page - ShootSync
 * Record bags for a shoot
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import BagRecorder from '../../components/bags/BagRecorder'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import Select from '../../components/common/Select'

const MOCK_SHOOTS = [
  { id: '1', name: 'Manor Fields - 11 Jan', date: '2026-01-11', drivesPlanned: 4 },
  { id: '2', name: 'Beatrice Farm - 18 Jan', date: '2026-01-18', drivesPlanned: 4 },
]

export default function BagRecord() {
  const [selectedShootId, setSelectedShootId] = useState('')
  const [recordedDrives, setRecordedDrives] = useState<number[]>([])

  const selectedShoot = MOCK_SHOOTS.find(s => s.id === selectedShootId)

  const handleSave = async (data: any) => {
    console.log('[BagRecord] Saving:', data)
    setRecordedDrives(prev => [...prev, data.driveNumber])
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return (
    <>
      <Helmet>
        <title>Record Bag - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="Record Bag"
        subtitle="Record the bag for each drive"
      >
        <div className="max-w-2xl mx-auto">
          {!selectedShoot ? (
            <Card>
              <CardHeader title="Select Shoot" />
              <CardContent>
                <Select
                  label="Shoot Day"
                  value={selectedShootId}
                  onChange={(e) => setSelectedShootId(e.target.value)}
                  options={MOCK_SHOOTS.map(s => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  placeholder="Select a shoot..."
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <BagRecorder
                shootId={selectedShoot.id}
                shootName={selectedShoot.name}
                drivesPlanned={selectedShoot.drivesPlanned}
                onSave={handleSave}
              />

              {recordedDrives.length > 0 && (
                <Card className="mt-6">
                  <CardHeader title="Recorded Drives" />
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {recordedDrives.map(drive => (
                        <span
                          key={drive}
                          className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-sm"
                        >
                          Drive {drive} ✓
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
