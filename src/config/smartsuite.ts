// SmartSuite API Configuration
export const SMARTSUITE_CONFIG = {
  accountId: 'sba974gi',
  baseUrl: 'https://app.smartsuite.com/api/v1',
  
  // Table IDs
  tables: {
    syndicates: '696cd58827f0a9bb79d62f48',
    members: '696cd5bae445b77cb645bb07',
    beaters: '696cd5c46468bc82847276df',
    shootDays: '696cd5cf10eb0f015772774b',
    shootAttendance: '696cd5db0d29b246e7e5f8ac',
    guestGuns: '696cd5effaf2c28d607276e9',
    bagRecords: '696cd5f9f1df1f96817276f6',
    beaterPayments: '696cd60661b6f12ca727272c',
    memberPayments: '696cd61327f0a9bb79d6317f',
    beaterBookings: '696cd6257ffd6caf13e5f8aa',
    activityLog: '696cd63041d45c89222a2749',
  },
}

// Get API key from environment
export const getSmartSuiteApiKey = (): string => {
  const apiKey = import.meta.env.VITE_SMARTSUITE_API_KEY
  if (!apiKey) {
    throw new Error('SmartSuite API key not configured')
  }
  return apiKey
}

// Common headers for API requests
export const getSmartSuiteHeaders = () => ({
  'Authorization': `Token ${getSmartSuiteApiKey()}`,
  'Account-Id': SMARTSUITE_CONFIG.accountId,
  'Content-Type': 'application/json',
})
