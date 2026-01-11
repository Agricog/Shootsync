/**
 * Members Page - ShootSync
 * Member management for captains
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal, { ModalFooter } from '../../components/common/Modal'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import { validateInput } from '../../utils/validation'
import type { Member, MemberRole } from '../../types/member'

const MOCK_MEMBERS: Member[] = [
  { id: '1', syndicateId: '1', clerkUserId: 'u1', email: 'john@example.com', name: 'John Smith', phone: '07700 900001', role: 'gun', emergencyContactName: 'Jane Smith', emergencyContactPhone: '07700 900002', subscriptionStatus: 'paid', invitedAt: '2024-08-01', acceptedAt: '2024-08-02', status: 'active' },
  { id: '2', syndicateId: '1', clerkUserId: 'u2', email: 'dave@example.com', name: 'Dave Wilson', phone: '07700 900003', role: 'gun', emergencyContactName: 'Mary Wilson', emergencyContactPhone: '07700 900004', subscriptionStatus: 'paid', invitedAt: '2024-08-01', acceptedAt: '2024-08-03', status: 'active' },
  { id: '3', syndicateId: '1', clerkUserId: 'u3', email: 'mike@example.com', name: 'Mike Roberts', phone: '07700 900005', role: 'gun', emergencyContactName: 'Sue Roberts', emergencyContactPhone: '07700 900006', subscriptionStatus: 'unpaid', invitedAt: '2024-08-05', status: 'pending' },
]

export default function Members() {
  const [members] = useState<Member[]>(MOCK_MEMBERS)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'gun' as MemberRole })
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({})
  const [isInviting, setIsInviting] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    if (!inviteForm.name.trim()) {
      errors.name = 'Name is required'
    }

    const emailValidation = validateInput(inviteForm.email, 'email')
    if (!emailValidation.isValid) {
      errors.email = 'Valid email is required'
    }

    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors)
      return
    }

    setIsInviting(true)
    try {
      // TODO: API call to invite member
      console.log('[Members] Inviting:', inviteForm)
      await new Promise(resolve => setTimeout(resolve, 1000))
      setIsInviteModalOpen(false)
      setInviteForm({ name: '', email: '', role: 'gun' })
    } catch (err) {
      setInviteErrors({ form: 'Failed to send invite' })
    } finally {
      setIsInviting(false)
    }
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingMembers = members.filter(m => m.status === 'pending')

  return (
    <>
      <Helmet>
        <title>Members - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="Members"
        subtitle={`${activeMembers.length} active, ${pendingMembers.length} pending`}
        action={
          <Button onClick={() => setIsInviteModalOpen(true)}>
            Invite Member
          </Button>
        }
      >
        <Card>
          <CardHeader title="All Members" />
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Name</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Email</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Role</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Subscription</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Status</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <p className="text-white font-medium">{member.name}</p>
                        <p className="text-slate-500 text-sm">{member.phone}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{member.email}</td>
                      <td className="py-3 px-4">
                        <RoleBadge role={member.role} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={member.subscriptionStatus} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm">View</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Invite Member"
          description="Send an invitation to join your syndicate"
        >
          <form onSubmit={handleInvite}>
            {inviteErrors.form && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-500 text-sm">{inviteErrors.form}</p>
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Full name"
                value={inviteForm.name}
                onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                error={inviteErrors.name}
                required
              />
              <Input
                type="email"
                label="Email address"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                error={inviteErrors.email}
                required
              />
              <Select
                label="Role"
                value={inviteForm.role}
                onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value as MemberRole }))}
                options={[
                  { value: 'gun', label: 'Gun' },
                  { value: 'beater', label: 'Beater' },
                ]}
              />
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setIsInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isInviting}>
                Send Invite
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      </DashboardLayout>
    </>
  )
}

function RoleBadge({ role }: { role: MemberRole }) {
  const styles: Record<MemberRole, string> = {
    captain: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    gun: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    beater: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hybrid: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${styles[role]}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    paid: 'bg-green-500/10 text-green-400 border-green-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    unpaid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${styles[status] || styles.inactive}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
