import type { AppData, FinishInput, JobTotals, Material, MaterialInput, MaterialUsage, PrintJobStatus } from './types'

export const now = () => new Date().toISOString()

export const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const formatNumber = (value: number, digits = 1) => {
  const fixed = value.toFixed(digits)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

export const remainingWeight = (material: Material, usages: MaterialUsage[]) => {
  const consumed = usages
    .filter((usage) => usage.materialId === material.id && usage.actualWeightG !== null)
    .reduce((total, usage) => total + (usage.actualWeightG ?? 0), 0)
  return Math.max(0, round2(material.initialWeightG - consumed))
}

export const consumedWeight = (material: Material, usages: MaterialUsage[]) =>
  round2(material.initialWeightG - remainingWeight(material, usages))

export const remainingPercent = (material: Material, usages: MaterialUsage[]) =>
  Math.max(0, Math.min(100, round2((remainingWeight(material, usages) / material.initialWeightG) * 100)))

export const unitCost = (material: Material) => material.price / material.initialWeightG

export const usageCost = (usage: MaterialUsage, material: Material) =>
  usage.actualWeightG === null ? 0 : usage.actualWeightG * unitCost(material)

export const defaultActualWeightG = (status: Exclude<PrintJobStatus, 'PRINTING'>, estimatedWeightG: number): number | null => {
  if (status === 'COMPLETED') return estimatedWeightG
  if (status === 'CANCELLED') return 0
  return null
}

export const jobTotals = (jobId: string, usages: MaterialUsage[], materials: Material[]): JobTotals => {
  const jobUsages = usages.filter((usage) => usage.printJobId === jobId)
  const estimated = round2(jobUsages.reduce((sum, usage) => sum + usage.estimatedWeightG, 0))
  const actual = round2(jobUsages.reduce((sum, usage) => sum + (usage.actualWeightG ?? 0), 0))
  const difference = round2(actual - estimated)
  const differencePercent = estimated === 0 ? null : round2((difference / estimated) * 100)
  const cost = round2(jobUsages.reduce((sum, usage) => {
    const material = materials.find((item) => item.id === usage.materialId)
    return sum + (material ? usageCost(usage, material) : 0)
  }, 0))
  return { estimated, actual, difference, differencePercent, cost }
}

export const validateMaterial = (input: MaterialInput) => {
  const errors: Partial<Record<keyof MaterialInput, string>> = {}
  if (!input.brand.trim()) errors.brand = '请输入品牌'
  if (!input.materialType.trim()) errors.materialType = '请输入材料类型'
  if (!input.color.trim()) errors.color = '请输入颜色'
  if (!input.currentLocation.trim()) errors.currentLocation = '请输入当前位置'
  if (!Number.isFinite(input.initialWeightG) || input.initialWeightG <= 0) errors.initialWeightG = '重量必须大于 0'
  if (!Number.isFinite(input.price) || input.price < 0) errors.price = '价格不能小于 0'
  return errors
}

export const validateStart = (name: string, selections: Array<{ materialId: string; estimatedWeightG: number }>) => {
  const errors: string[] = []
  if (!name.trim()) errors.push('请填写打印任务名称')
  if (selections.length === 0) errors.push('至少添加一种耗材')
  if (new Set(selections.map((item) => item.materialId)).size !== selections.length) errors.push('同一卷耗材不能重复添加')
  if (selections.some((item) => !Number.isFinite(item.estimatedWeightG) || item.estimatedWeightG < 0)) errors.push('预计消耗重量不能为负数')
  return errors
}

export const validateFinish = (data: AppData, jobId: string, inputs: FinishInput[]) => {
  const job = data.printJobs.find((item) => item.id === jobId)
  const usages = data.usages.filter((item) => item.printJobId === jobId)
  const errors: string[] = []
  if (!job) errors.push('找不到该打印任务')
  if (job && job.status !== 'PRINTING') errors.push('该打印任务已经结束，不能重复提交')
  if (inputs.length !== usages.length || usages.some((usage) => !inputs.some((input) => input.usageId === usage.id))) errors.push('请填写全部耗材的实际消耗')
  inputs.forEach((input) => {
    if (input.actualWeightG === null || !Number.isFinite(input.actualWeightG) || input.actualWeightG < 0) errors.push('实际消耗重量不能为负数，且不能为空')
    const usage = usages.find((item) => item.id === input.usageId)
    const material = data.materials.find((item) => item.id === usage?.materialId)
    if (usage && material && input.actualWeightG !== null && input.actualWeightG > remainingWeight(material, data.usages)) {
      errors.push(`${material.brand} ${material.name || material.materialType} 的实际消耗超过当前剩余重量`)
    }
  })
  return [...new Set(errors)]
}

export const createMaterial = (input: MaterialInput): Material => {
  const timestamp = now()
  return {
    id: makeId('mat'),
    brand: input.brand.trim(),
    materialType: input.materialType.trim().toUpperCase(),
    name: input.name.trim() || undefined,
    color: input.color.trim(),
    initialWeightG: round2(input.initialWeightG),
    price: round2(input.price),
    status: 'MOUNTED',
    currentLocation: input.currentLocation.trim(),
    note: input.note.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const startPrint = (data: AppData, name: string, note: string, selections: Array<{ materialId: string; estimatedWeightG: number }>): AppData => {
  const validation = validateStart(name, selections)
  if (validation.length) throw new Error(validation[0])
  const timestamp = now()
  const jobId = makeId('job')
  const job = { id: jobId, name: name.trim(), status: 'PRINTING' as const, note: note.trim() || undefined, createdAt: timestamp, startedAt: timestamp }
  const newUsages = selections.map((item) => ({
    id: makeId('usage'), printJobId: jobId, materialId: item.materialId,
    estimatedWeightG: round2(item.estimatedWeightG), actualWeightG: null, createdAt: timestamp, updatedAt: timestamp,
  }))
  return { ...data, printJobs: [job, ...data.printJobs], usages: [...data.usages, ...newUsages] }
}

export const finishPrint = (data: AppData, jobId: string, status: Exclude<PrintJobStatus, 'PRINTING'>, inputs: FinishInput[]): AppData => {
  const errors = validateFinish(data, jobId, inputs)
  if (errors.length) throw new Error(errors[0])
  const timestamp = now()
  const inputById = new Map(inputs.map((input) => [input.usageId, input.actualWeightG]))
  return {
    ...data,
    printJobs: data.printJobs.map((job) => job.id === jobId ? { ...job, status, finishedAt: timestamp } : job),
    usages: data.usages.map((usage) => usage.printJobId === jobId ? { ...usage, actualWeightG: round2(inputById.get(usage.id) ?? 0), updatedAt: timestamp } : usage),
  }
}

export const updateMaterialStatus = (data: AppData, materialId: string, status: 'MOUNTED' | 'STORED' | 'EMPTY', location?: string): AppData => {
  const material = data.materials.find((item) => item.id === materialId)
  if (!material) throw new Error('找不到该耗材')
  if (status === 'STORED' && !location?.trim()) throw new Error('卸下耗材时需要填写存放位置')
  if (status === 'MOUNTED' && !location?.trim()) throw new Error('挂载耗材时需要填写位置')
  return {
    ...data,
    materials: data.materials.map((item) => item.id === materialId ? { ...item, status, currentLocation: location?.trim() || item.currentLocation, updatedAt: now() } : item),
  }
}
