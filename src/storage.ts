import type { AppData, Material, MaterialUsage, PrintJob } from './types'

const STORAGE_KEY = 'filament-flow-v1'

const daysAgo = (days: number, hour: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, 24, 0, 0)
  return date.toISOString()
}

const seedData = (): AppData => {
  const materials: Material[] = [
    { id: 'mat_black', brand: 'Bambu Lab', materialType: 'PLA', name: 'Basic', color: '哑光黑', initialWeightG: 1000, price: 99, status: 'MOUNTED', currentLocation: 'AMS A2', note: '常用黑色，打印支架很顺手', createdAt: daysAgo(20, 11), updatedAt: daysAgo(1, 9) },
    { id: 'mat_yellow', brand: 'eSUN', materialType: 'PLA+', name: 'Silk', color: '柠檬黄', initialWeightG: 1000, price: 89, status: 'MOUNTED', currentLocation: 'AMS A1', note: '丝绸质感', createdAt: daysAgo(18, 15), updatedAt: daysAgo(2, 18) },
    { id: 'mat_red', brand: 'Bambu Lab', materialType: 'PLA', name: 'Basic', color: '火焰红', initialWeightG: 1000, price: 99, status: 'MOUNTED', currentLocation: 'AMS A3', createdAt: daysAgo(14, 10), updatedAt: daysAgo(3, 13) },
    { id: 'mat_white', brand: 'Polymaker', materialType: 'PETG', name: 'PolyLite', color: '自然白', initialWeightG: 750, price: 109, status: 'STORED', currentLocation: '干燥箱 A2', note: '下次做功能件', createdAt: daysAgo(11, 16), updatedAt: daysAgo(5, 17) },
    { id: 'mat_blue', brand: 'eSUN', materialType: 'TPU', name: '95A', color: '湖水蓝', initialWeightG: 1000, price: 129, status: 'STORED', currentLocation: '储物柜 B1', createdAt: daysAgo(8, 12), updatedAt: daysAgo(4, 8) },
  ]
  const jobs: PrintJob[] = [
    { id: 'job_pika', name: '皮卡丘桌面摆件', status: 'COMPLETED', createdAt: daysAgo(1, 9), startedAt: daysAgo(1, 9), finishedAt: daysAgo(1, 13) },
    { id: 'job_tray', name: '桌面理线托盘', status: 'COMPLETED', note: '层高 0.2mm', createdAt: daysAgo(3, 14), startedAt: daysAgo(3, 14), finishedAt: daysAgo(3, 18) },
    { id: 'job_hook', name: '墙面挂钩 · 第二版', status: 'FAILED', note: '中途发现底面翘起', createdAt: daysAgo(5, 10), startedAt: daysAgo(5, 10), finishedAt: daysAgo(5, 12) },
  ]
  const usages: MaterialUsage[] = [
    { id: 'usage_pika_yellow', printJobId: 'job_pika', materialId: 'mat_yellow', estimatedWeightG: 82, actualWeightG: 86.5, createdAt: daysAgo(1, 9), updatedAt: daysAgo(1, 13) },
    { id: 'usage_pika_black', printJobId: 'job_pika', materialId: 'mat_black', estimatedWeightG: 13, actualWeightG: 12.2, createdAt: daysAgo(1, 9), updatedAt: daysAgo(1, 13) },
    { id: 'usage_pika_red', printJobId: 'job_pika', materialId: 'mat_red', estimatedWeightG: 7, actualWeightG: 8.1, createdAt: daysAgo(1, 9), updatedAt: daysAgo(1, 13) },
    { id: 'usage_tray_black', printJobId: 'job_tray', materialId: 'mat_black', estimatedWeightG: 124, actualWeightG: 118.7, createdAt: daysAgo(3, 14), updatedAt: daysAgo(3, 18) },
    { id: 'usage_hook_red', printJobId: 'job_hook', materialId: 'mat_red', estimatedWeightG: 100, actualWeightG: 37, createdAt: daysAgo(5, 10), updatedAt: daysAgo(5, 12) },
  ]
  return { materials, printJobs: jobs, usages }
}

export const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AppData
  } catch {
    // Fall back to the sample workspace if local storage is unavailable or corrupted.
  }
  return seedData()
}

export const saveData = (data: AppData) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

export const resetData = () => localStorage.removeItem(STORAGE_KEY)
