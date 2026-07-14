import { getCurrentMonthStart } from '@/lib/utils/quota'

describe('Quota Utilities', () => {
  it('getCurrentMonthStart returns first day of month at UTC midnight', () => {
    // Current month, 1st day, 00:00:00 UTC
    const start = getCurrentMonthStart()
    expect(start.getUTCDate()).toBe(1)
    expect(start.getUTCHours()).toBe(0)
    expect(start.getUTCMinutes()).toBe(0)
  })
})
