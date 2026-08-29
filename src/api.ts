import { createMaterial, finishPrint, startPrint, updateMaterialStatus } from './domain'
import type { AppData, FinishInput, MaterialInput, PrintJobStatus } from './types'

// V1 的本地 API 适配层：当前用 localStorage 持久化，后续可将实现替换成 HTTP 请求，页面不需要改动。
export const materialApi = {
  create: (data: AppData, input: MaterialInput) => ({ data: { ...data, materials: [createMaterial(input), ...data.materials] } }),
  setStatus: (data: AppData, id: string, status: 'MOUNTED' | 'STORED' | 'EMPTY', location?: string) => ({ data: updateMaterialStatus(data, id, status, location) }),
}

export const printApi = {
  start: (data: AppData, name: string, note: string, selections: Array<{ materialId: string; estimatedWeightG: number }>) => ({ data: startPrint(data, name, note, selections) }),
  finish: (data: AppData, jobId: string, status: Exclude<PrintJobStatus, 'PRINTING'>, inputs: FinishInput[]) => ({ data: finishPrint(data, jobId, status, inputs) }),
}
