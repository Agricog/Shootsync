/**
 * My Pegs Page - ShootSync
 * Peg history for guns
 */

import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../components/common/Card'

const PEG_HISTORY = [
  { id: '1', date: '2026-01-11', location: 'Manor Fields', peg: 7, bag: 14, drives: 4 },
  { id: '2', date: '2026-01-04', location: 'Beatrice Farm', peg: 2, bag: 18, drives: 4 },
  { id: '3', date: '2025-12-28', location: 'Oakwood Estate', peg: 5, bag: 12, drives: 5 },
  { id: '4', date: '2025-12-21', location: 'Beatrice Farm', peg: 9, bag: 16, drives: 4 },
  { id: '5', date: '2025-12-14', location: 'Manor Fields', peg: 3, bag: 11, drives: 4 },
  { id: '6', date: '2025-12-07', location: 'Beatrice Farm', peg: 6, bag: 15, drives: 4 },
]

export default function MyPegs() {
  const pegDistribution = calculatePegDistribution(PEG_HISTORY)
  const totalBag = PEG_HISTORY.reduce((sum, h) => sum + h.bag, 0)
  const avgBag = Math.round(totalBag / PEG_HISTORY.length)

  return (
    <>
      <Helmet>
        <title>My Pegs - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="My Peg History"
        subtitle={`${PEG_HISTORY.length} shoots this season`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Total Bag</p>
              <p className="text-3xl font-bold text-white mt-1">{totalBag}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Average Per Shoot</p>
              <p className="text-3xl font-bold text-white mt-1">{avgBag}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Fairness Score</p>
              <p className="text-3xl font-bold text-green-500 mt-1">94%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Shoot History" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 text-slate-400 font-medium text-sm">Date</th>
                      <th className="text-left py-2 text-slate-400 font-medium text-sm">Location</th>
                      <th className="text-center py-2 text-slate-400 font-medium text-sm">Peg</th>
                      <th className="text-right py-2 text-slate-400 font-medium text-sm">Bag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PEG_HISTORY.map((record) => (
                      <tr key={record.id} className="border-b border-slate-700/50">
                        <td className="py-3 text-slate-300 text-sm">
                          {new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-3 text-white text-sm">{record.location}</td>
                        <td className="py-3 text-center">
                          <span className="inline-flex w-7 h-7 bg-slate-700 rounded-full items-center justify-center text-white text-sm font-medium">
                            {record.peg}
                          </span>
                        </td>
                        <td className="py-3 text-right text-green-400 text-sm">{record.bag}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Peg Distribution" subtitle="How often you've had each peg" />
            <CardContent>
              <div className="space-y-3">
                {Object.entries(pegDistribution)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([peg, count]) => (
                    <div key={peg} className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {peg}
                      </span>
                      <div className="flex-1">
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(count / PEG_HISTORY.length) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-slate-400 text-sm w-16 text-right">
                        {count} {count === 1 ? 'time' : 'times'}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  )
}

function calculatePegDistribution(history: typeof PEG_HISTORY): Record<number, number> {
  return history.reduce((acc, record) => {
    acc[record.peg] = (acc[record.peg] || 0) + 1
    return acc
  }, {} as Record<number, number>)
}
