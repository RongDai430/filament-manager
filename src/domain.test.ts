import { describe, expect, it } from 'vitest'
import { defaultActualWeightG, finishPrint, remainingWeight, startPrint, unitCost } from './domain'
import type { AppData, Material } from './types'

const material = (id: string, price = 100, status: Material['status'] = 'MOUNTED'): Material => ({
  id, brand: 'Test Brand', materialType: 'PLA', name: 'Basic', color: id, initialWeightG: 1000, price,
  status, currentLocation: 'AMS A1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})
const emptyData = (materials: Material[] = [material('a')]): AppData => ({ materials, printJobs: [], usages: [] })

describe('filament usage domain', () => {
  it('provides finish defaults for each final status', () => {
    expect(defaultActualWeightG('COMPLETED', 82)).toBe(82)
    expect(defaultActualWeightG('CANCELLED', 82)).toBe(0)
    expect(defaultActualWeightG('FAILED', 82)).toBeNull()
  })

  it('calculates single-material remaining weight and cost from actual usage', () => {
    const started = startPrint(emptyData(), 'single color', '', [{ materialId: 'a', estimatedWeightG: 100 }])
    const finished = finishPrint(started, started.printJobs[0].id, 'COMPLETED', [{ usageId: started.usages[0].id, actualWeightG: 110 }])
    expect(remainingWeight(finished.materials[0], finished.usages)).toBe(890)
    expect(unitCost(finished.materials[0]) * 110).toBe(11)
  })

  it('supports multiple materials on one print and sums their cost', () => {
    const started = startPrint(emptyData([material('a', 100), material('b', 200)]), 'multi color', '', [
      { materialId: 'a', estimatedWeightG: 100 }, { materialId: 'b', estimatedWeightG: 50 },
    ])
    const finished = finishPrint(started, started.printJobs[0].id, 'COMPLETED', [
      { usageId: started.usages[0].id, actualWeightG: 120 }, { usageId: started.usages[1].id, actualWeightG: 40 },
    ])
    expect(remainingWeight(finished.materials[0], finished.usages)).toBe(880)
    expect(remainingWeight(finished.materials[1], finished.usages)).toBe(960)
    expect(120 * 0.1 + 40 * 0.2).toBe(20)
  })

  it('allows an insufficient estimate as a warning, but blocks negative stock on finish', () => {
    const started = startPrint(emptyData(), 'low stock', '', [{ materialId: 'a', estimatedWeightG: 1050 }])
    expect(() => finishPrint(started, started.printJobs[0].id, 'COMPLETED', [{ usageId: started.usages[0].id, actualWeightG: 1001 }])).toThrow('超过当前剩余重量')
  })

  it('deducts actual usage for failed jobs and refuses a second finish', () => {
    const started = startPrint(emptyData(), 'failed print', '', [{ materialId: 'a', estimatedWeightG: 100 }])
    const finished = finishPrint(started, started.printJobs[0].id, 'FAILED', [{ usageId: started.usages[0].id, actualWeightG: 37 }])
    expect(remainingWeight(finished.materials[0], finished.usages)).toBe(963)
    expect(() => finishPrint(finished, started.printJobs[0].id, 'FAILED', [{ usageId: started.usages[0].id, actualWeightG: 37 }])).toThrow('已经结束')
  })

  it('persists a material identity across mount and unmount transitions', () => {
    const stored = { ...emptyData(), materials: [material('a', 100, 'STORED')] }
    const mounted = { ...stored, materials: stored.materials.map((item) => ({ ...item, status: 'MOUNTED' as const, currentLocation: 'AMS A3' })) }
    expect(mounted.materials[0].id).toBe('a')
    expect(mounted.materials[0].price).toBe(100)
    expect(mounted.materials[0].currentLocation).toBe('AMS A3')
  })
})
