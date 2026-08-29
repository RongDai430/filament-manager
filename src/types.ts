export type MaterialStatus = 'MOUNTED' | 'STORED' | 'EMPTY' | 'DISABLED'
export type PrintJobStatus = 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type MaterialColorCategory = 'STANDARD' | 'METALLIC' | 'CUSTOM'

export interface Material {
  id: string
  brand: string
  materialType: string
  name?: string
  color: string
  colorCategory?: MaterialColorCategory
  colorHex?: string
  pantoneCode?: string
  initialWeightG: number
  price: number
  status: MaterialStatus
  currentLocation: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface PrintJob {
  id: string
  name: string
  status: PrintJobStatus
  note?: string
  createdAt: string
  startedAt: string
  finishedAt?: string
}

export interface MaterialUsage {
  id: string
  printJobId: string
  materialId: string
  estimatedWeightG: number
  actualWeightG: number | null
  createdAt: string
  updatedAt: string
}

export interface AppData {
  materials: Material[]
  printJobs: PrintJob[]
  usages: MaterialUsage[]
}

export interface MaterialInput {
  brand: string
  materialType: string
  name: string
  color: string
  colorCategory?: MaterialColorCategory
  colorHex?: string
  pantoneCode?: string
  initialWeightG: number
  price: number
  currentLocation: string
  note: string
}

export interface FinishInput {
  usageId: string
  actualWeightG: number | null
}

export interface JobTotals {
  estimated: number
  actual: number
  difference: number
  differencePercent: number | null
  cost: number
}
