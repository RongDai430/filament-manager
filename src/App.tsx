import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { materialApi, printApi } from './api'
import { defaultActualWeightG, formatNumber, jobTotals, remainingPercent, remainingWeight, round2, unitCost, validateMaterial } from './domain'
import { fetchMakerWorldRecommendations } from './makerworld'
import { loadData, saveData } from './storage'
import type { AppData, FinishInput, Material, MaterialColorCategory, MaterialInput, MaterialStatus, PrintJob, PrintJobStatus } from './types'
import type { MakerWorldModel } from './makerworld'

type Page = 'dashboard' | 'materials' | 'add-material' | 'start-print' | 'printing-detail' | 'finish-print' | 'history' | 'job-detail' | 'material-detail'
type Toast = { message: string; type: 'success' | 'error' | 'info' }
type ActionModal = { action: 'mount' | 'unmount' | 'empty'; material: Material }

const navItems: Array<{ id: Page; label: string; icon: IconName }> = [
  { id: 'dashboard', label: '工作台', icon: 'grid' },
  { id: 'materials', label: '耗材', icon: 'roll' },
  { id: 'history', label: '打印记录', icon: 'history' },
]

const colorHex: Record<string, string> = {
  '哑光黑': '#252a2d', '黑色': '#252a2d', '柠檬黄': '#f5c842', '黄色': '#f5c842', '火焰红': '#ee664f', '红色': '#ee664f',
  '自然白': '#e9e4d8', '白色': '#e9e4d8', '湖水蓝': '#56adc2', '蓝色': '#56adc2', '草绿色': '#74aa65', '紫色': '#9b7bc2',
}

type ColorOption = { label: string; hex: string }

const standardColors: ColorOption[] = [
  { label: '黑色', hex: '#252A2D' }, { label: '白色', hex: '#F4F2ED' }, { label: '灰色', hex: '#9CA3A8' },
  { label: '红色', hex: '#D9574C' }, { label: '橙色', hex: '#E98A4C' }, { label: '黄色', hex: '#F2C84B' },
  { label: '绿色', hex: '#70A36F' }, { label: '蓝色', hex: '#5B9FBD' }, { label: '紫色', hex: '#9272B8' },
  { label: '棕色', hex: '#8B6349' }, { label: '米色', hex: '#D9C5A4' }, { label: '透明', hex: '#DCE7E3' },
]

const metallicColors: ColorOption[] = [
  { label: '金色', hex: '#D6AF52' }, { label: '银色', hex: '#B8BCC2' }, { label: '铜色', hex: '#B87333' },
  { label: '青铜色', hex: '#8C6B4F' }, { label: '枪灰', hex: '#4A5259' }, { label: '金属红', hex: '#A83D46' },
  { label: '金属蓝', hex: '#3E6F9B' },
]

const colorCategoryLabels: Record<MaterialColorCategory, string> = { STANDARD: '标准色', METALLIC: '金属色', CUSTOM: '潘通 / 自定义' }
const colorCategoryItems: Array<{ key: MaterialColorCategory; label: string }> = [
  { key: 'STANDARD', label: colorCategoryLabels.STANDARD },
  { key: 'METALLIC', label: colorCategoryLabels.METALLIC },
  { key: 'CUSTOM', label: colorCategoryLabels.CUSTOM },
]
const resolveColorHex = (color: string, selectedHex?: string) => selectedHex || colorHex[color] || '#c1b9ad'

const pageCopy: Record<Page, { eyebrow: string; title: string; description?: string }> = {
  dashboard: { eyebrow: 'Workspace / 01', title: '耗材工作台', description: '保持每一卷耗材都在掌控之中。' },
  materials: { eyebrow: 'Inventory / 02', title: '耗材', description: '查看、挂载和管理每一卷真实使用过的耗材。' },
  'add-material': { eyebrow: 'Inventory / 02', title: '录入新耗材', description: '第一次使用一卷新耗材时，建立它的长期记录。' },
  'start-print': { eyebrow: 'Print / 03', title: '开始打印', description: '先记下预计消耗，打印结束后再确认实际用量。' },
  'printing-detail': { eyebrow: 'Print / 03', title: '打印中', description: '任务进行中，实际消耗会在结束时录入。' },
  'finish-print': { eyebrow: 'Print / 03', title: '结束打印', description: '记录每种耗材的实际损耗，完成本次核算。' },
  history: { eyebrow: 'Archive / 04', title: '打印记录', description: '所有已经发生的耗材消耗，都在这里留下痕迹。' },
  'job-detail': { eyebrow: 'Archive / 04', title: '打印详情', description: '查看这次打印的耗材构成与核算结果。' },
  'material-detail': { eyebrow: 'Inventory / 02', title: '耗材详情', description: '这一卷耗材的完整履历。' },
}

type IconName = 'grid' | 'roll' | 'history' | 'plus' | 'play' | 'arrow' | 'chevron' | 'search' | 'more' | 'mount' | 'unmount' | 'empty' | 'close' | 'back' | 'check' | 'warning' | 'clock' | 'calendar' | 'cost' | 'location' | 'filter' | 'external'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    roll: <><path d="M5 4.5h13.5a1.5 1.5 0 0 1 0 3H9.5a2.5 2.5 0 1 0 0 5h7a2.5 2.5 0 1 1 0 5H5" /><circle cx="5" cy="4.5" r="1.5" /><circle cx="5" cy="19.5" r="1.5" /></>,
    history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 4.5v5h5" /><path d="M12 7.5v5l3.5 2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    mount: <><path d="M12 4v11" /><path d="m8 11 4 4 4-4" /><path d="M5 19h14" /></>,
    unmount: <><path d="M12 20V9" /><path d="m8 13 4-4 4 4" /><path d="M5 5h14" /></>,
    empty: <><path d="M4 7h16" /><path d="M9 7V4h6v3M7 7l1 13h8l1-13" /><path d="M10 11v5M14 11v5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    back: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    warning: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9h17" /></>,
    cost: <><circle cx="12" cy="12" r="8.5" /><path d="M14.7 8.8c-.7-.7-1.6-1.1-2.8-1.1-1.5 0-2.5.8-2.5 1.9 0 2.8 5.5 1.1 5.5 4.1 0 1.2-1.1 2-2.8 2-1.2 0-2.2-.4-2.9-1.2M12 6.5v11" /></>,
    location: <><path d="M19 10.4c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10.4" r="2.2" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    external: <><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 13v4.5A1.5 1.5 0 0 1 16.5 19h-9A1.5 1.5 0 0 1 6 17.5v-9A1.5 1.5 0 0 1 7.5 7H12" /></>,
  }
  return <svg {...common} aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [actionModal, setActionModal] = useState<ActionModal | null>(null)

  useEffect(() => { saveData(data) }, [data])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navigate = (nextPage: Page, id?: string) => {
    setPage(nextPage)
    setSelectedId(id ?? null)
    setMobileNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const commit = (next: AppData) => setData(next)
  const showError = (error: unknown) => setToast({ type: 'error', message: error instanceof Error ? error.message : '操作没有完成，请重试' })
  const selectedJob = data.printJobs.find((job) => job.id === selectedId)
  const selectedMaterial = data.materials.find((material) => material.id === selectedId)
  const mounted = data.materials.filter((material) => material.status === 'MOUNTED')
  const printingJobs = data.printJobs.filter((job) => job.status === 'PRINTING')

  const handleStatus = (status: ActionModal['action'], location?: string) => {
    if (!actionModal) return
    try {
      if (status === 'empty') commit(materialApi.setStatus(data, actionModal.material.id, 'EMPTY').data)
      if (status === 'mount') commit(materialApi.setStatus(data, actionModal.material.id, 'MOUNTED', location).data)
      if (status === 'unmount') commit(materialApi.setStatus(data, actionModal.material.id, 'STORED', location).data)
      setActionModal(null)
      setToast({ type: 'success', message: status === 'mount' ? '耗材已挂载' : status === 'unmount' ? '耗材已卸下并存放' : '已标记为用完' })
    } catch (error) { showError(error) }
  }

  const pageNode = (() => {
    switch (page) {
      case 'dashboard': return <Dashboard data={data} navigate={navigate} />
      case 'materials': return <MaterialsPage data={data} navigate={navigate} setActionModal={setActionModal} />
      case 'add-material': return <AddMaterialPage onCancel={() => navigate('materials')} onCreated={(input) => { commit(materialApi.create(data, input).data); setToast({ type: 'success', message: '新耗材已录入' }); navigate('materials') }} />
      case 'start-print': return <StartPrintPage data={data} onCancel={() => navigate('dashboard')} onStarted={(next, id) => { commit(next); setToast({ type: 'success', message: '打印任务已开始' }); navigate('printing-detail', id) }} onError={showError} />
      case 'printing-detail': return selectedJob ? <PrintingDetailPage data={data} job={selectedJob} navigate={navigate} /> : <EmptyState title="没有找到打印任务" action="回到工作台" onAction={() => navigate('dashboard')} />
      case 'finish-print': return selectedJob ? <FinishPrintPage data={data} job={selectedJob} onCancel={() => navigate('printing-detail', selectedJob.id)} onFinished={(next) => { commit(next); setToast({ type: 'success', message: '打印结果已保存，耗材已核算' }) }} onError={showError} /> : <EmptyState title="没有找到打印任务" action="回到工作台" onAction={() => navigate('dashboard')} />
      case 'history': return <HistoryPage data={data} navigate={navigate} />
      case 'job-detail': return selectedJob ? <JobDetailPage data={data} job={selectedJob} navigate={navigate} /> : <EmptyState title="没有找到打印任务" action="回到打印记录" onAction={() => navigate('history')} />
      case 'material-detail': return selectedMaterial ? <MaterialDetailPage data={data} material={selectedMaterial} navigate={navigate} setActionModal={setActionModal} /> : <EmptyState title="没有找到耗材" action="回到耗材" onAction={() => navigate('materials')} />
    }
  })()

  const copy = pageCopy[page]
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="brand-lockup" onClick={() => navigate('dashboard')} role="button" tabIndex={0}>
          <div className="brand-mark"><span /><span /><span /></div>
          <div><div className="brand-name">FILAMENT <i>FLOW</i></div><div className="brand-caption">MATERIAL CONTROL</div></div>
        </div>
        <div className="sidebar-section-label">NAVIGATION</div>
        <nav className="main-nav">
          {navItems.map((item) => <button key={item.id} className={`nav-item ${page === item.id || (item.id === 'materials' && (page === 'material-detail' || page === 'add-material')) || (item.id === 'history' && page === 'job-detail') ? 'active' : ''}`} onClick={() => navigate(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{item.id === 'materials' && <span className="nav-count">{data.materials.length}</span>}</button>)}
        </nav>
        <div className="sidebar-section-label sidebar-section-label--spaced">QUICK ACTION</div>
        <button className="sidebar-action" onClick={() => navigate('start-print')}><span className="sidebar-action-icon"><Icon name="play" size={13} /></span><span>开始打印</span><Icon name="arrow" size={15} /></button>
        <div className="sidebar-bottom">
          <div className="storage-card"><div className="storage-card-head"><span>STORAGE HEALTH</span><span className="live-dot" /></div><div className="storage-value"><strong>{data.materials.filter((item) => item.status !== 'EMPTY' && item.status !== 'DISABLED').length}</strong><span>卷可用耗材</span></div><div className="storage-meter"><span style={{ width: `${Math.min(100, (data.materials.filter((item) => item.status !== 'EMPTY' && item.status !== 'DISABLED').length / Math.max(1, data.materials.length)) * 100)}%` }} /></div></div>
          <div className="profile-row"><div className="avatar">D</div><div><strong>DRAGON</strong><small>个人工作区</small></div><Icon name="more" size={17} /></div>
        </div>
      </aside>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="关闭导航" onClick={() => setMobileNavOpen(false)} />}
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)}><span /><span /><span /></button><div className="breadcrumbs"><span>FILAMENT FLOW</span><b>/</b><span className="current">{copy.eyebrow.split(' / ')[0]}</span></div><div className="topbar-right"><span className="sync-status"><span className="sync-dot" />本地已同步</span><button className="icon-button" title="搜索"><Icon name="search" /></button><div className="top-avatar">D</div></div></header>
        <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">{copy.eyebrow}</div><h1>{copy.title}</h1>{copy.description && <p>{copy.description}</p>}</div>{page === 'dashboard' && <button className="button button-primary button-with-icon" onClick={() => navigate('start-print')}><Icon name="play" size={14} />开始打印</button>}{page === 'materials' && <button className="button button-primary button-with-icon" onClick={() => navigate('add-material')}><Icon name="plus" size={17} />录入新耗材</button>}{page === 'history' && <div className="page-total">{data.printJobs.filter((job) => job.status !== 'PRINTING').length}<span>条记录</span></div>}</div>{pageNode}</div>
      </main>
      {actionModal && <StatusModal action={actionModal.action} material={actionModal.material} data={data} onClose={() => setActionModal(null)} onConfirm={handleStatus} />}
      {toast && <div className={`toast toast-${toast.type}`}><span className="toast-symbol">{toast.type === 'success' ? <Icon name="check" size={16} /> : toast.type === 'error' ? <Icon name="warning" size={16} /> : <Icon name="clock" size={16} />}</span>{toast.message}<button onClick={() => setToast(null)}><Icon name="close" size={14} /></button></div>}
    </div>
  )
}

function Dashboard({ data, navigate }: { data: AppData; navigate: (page: Page, id?: string) => void }) {
  const mounted = data.materials.filter((material) => material.status === 'MOUNTED')
  const available = data.materials.filter((material) => material.status !== 'EMPTY' && material.status !== 'DISABLED' && remainingWeight(material, data.usages) > 0)
  const printing = data.printJobs.filter((job) => job.status === 'PRINTING')
  const recentJobs = data.printJobs.filter((job) => job.status !== 'PRINTING').slice(0, 4)
  return <>
    <section className="metric-grid">
      <MetricCard label="当前挂载" value={mounted.length} suffix="卷" icon="mount" accent="coral" meta={mounted.length ? `${mounted.map((item) => item.currentLocation).join(' · ')}` : '暂无挂载'} />
      <MetricCard label="可用耗材" value={available.length} suffix="卷" icon="roll" accent="yellow" meta={`${data.materials.filter((item) => item.status === 'STORED').length} 卷在存放中`} />
      <MetricCard label="打印中" value={printing.length} suffix="项" icon="play" accent="blue" meta={printing.length ? printing[0].name : '当前没有进行中的任务'} />
      <MetricCard label="本月打印" value={data.printJobs.filter((job) => job.status !== 'PRINTING').length} suffix="项" icon="history" accent="green" meta="含完成、失败与取消" />
    </section>
    <section className="section-block mounted-section"><div className="section-heading"><div><div className="section-kicker">LIVE INVENTORY <span className="live-dot" /></div><h2>当前挂载耗材</h2></div><button className="text-button" onClick={() => navigate('materials')}>查看全部 <Icon name="arrow" size={15} /></button></div>{mounted.length ? <div className="mounted-grid">{mounted.map((material, index) => <MountedCard key={material.id} material={material} data={data} index={index} navigate={navigate} />)}</div> : <EmptyState title="还没有挂载耗材" action="录入新耗材" onAction={() => navigate('add-material')} compact />}</section>
    <MakerWorldRecommendations />
    <section className="lower-grid"><div className="recent-panel panel"><div className="panel-heading"><div><div className="section-kicker">RECENT ACTIVITY</div><h2>最近打印</h2></div><button className="icon-button subtle" onClick={() => navigate('history')}><Icon name="external" size={17} /></button></div>{recentJobs.length ? <div className="job-list">{recentJobs.map((job) => <JobListItem key={job.id} job={job} data={data} onClick={() => navigate('job-detail', job.id)} />)}</div> : <div className="empty-inline">还没有打印记录</div>}</div><div className="attention-panel panel"><div className="panel-heading"><div><div className="section-kicker">ATTENTION</div><h2>需要留意</h2></div><span className="attention-count">{data.materials.filter((item) => item.status === 'MOUNTED' && remainingPercent(item, data.usages) < 20).length}</span></div><div className="attention-list">{data.materials.filter((item) => item.status === 'MOUNTED' && remainingPercent(item, data.usages) < 20).map((material) => <div className="attention-item" key={material.id}><span className="attention-icon"><Icon name="warning" size={17} /></span><div><strong>{material.brand} {material.name || material.materialType}</strong><span>剩余 {formatNumber(remainingWeight(material, data.usages))}g，建议准备下一卷</span></div><Icon name="chevron" size={16} /></div>)}{!data.materials.some((item) => item.status === 'MOUNTED' && remainingPercent(item, data.usages) < 20) && <div className="all-good"><span className="all-good-icon"><Icon name="check" size={17} /></span><div><strong>库存状态良好</strong><span>目前没有低库存耗材</span></div></div>}</div></div></section>
  </>
}

function MakerWorldRecommendations() {
  const [models, setModels] = useState<MakerWorldModel[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const loadBatch = async (signal?: AbortSignal) => {
    setStatus('loading')
    try {
      const nextModels = await fetchMakerWorldRecommendations(signal)
      if (signal?.aborted) return
      setModels(nextModels)
      setStatus(nextModels.length ? 'ready' : 'error')
    } catch {
      if (signal?.aborted) return
      setModels([])
      setStatus('error')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadBatch(controller.signal)
    return () => controller.abort()
  }, [])

  return <section className="makerworld-section panel">
    <div className="panel-heading makerworld-heading">
      <div><div className="section-kicker">MAKERWORLD / RANDOM PICK</div><h2>MakerWorld 随机推荐</h2><p className="makerworld-description">从当前公开网页随机挑选 4 个模型，点击后查看详情。</p></div>
      <button type="button" className="text-button makerworld-refresh" onClick={() => void loadBatch()} disabled={status === 'loading'}>换一批 <Icon name="arrow" size={15} /></button>
    </div>
    {status === 'loading' && <div className="makerworld-state">正在获取 MakerWorld 推荐…</div>}
    {status === 'error' && <div className="makerworld-state makerworld-state-error"><strong>暂时无法获取 MakerWorld 推荐</strong><span>请稍后点击“换一批”重试。</span></div>}
    {status === 'ready' && <div className="makerworld-grid">{models.map((model) => <MakerWorldCard key={model.id} model={model} />)}</div>}
  </section>
}

function MakerWorldCard({ model }: { model: MakerWorldModel }) {
  return <a className="makerworld-card" href={model.url} target="_blank" rel="noopener noreferrer">
    <div className="makerworld-cover"><img src={model.imageUrl} alt="" loading="lazy" /></div>
    <div className="makerworld-card-copy"><strong title={model.name}>{model.name}</strong><span>作者 · {model.author}</span></div>
    <Icon name="external" size={16} />
  </a>
}

function MetricCard({ label, value, suffix, icon, accent, meta }: { label: string; value: number; suffix: string; icon: IconName; accent: string; meta: string }) {
  return <div className="metric-card"><div className={`metric-icon metric-icon-${accent}`}><Icon name={icon} size={20} /></div><div className="metric-label">{label}</div><div className="metric-value">{value}<small>{suffix}</small></div><div className="metric-meta">{meta}</div></div>
}

function MountedCard({ material, data, index, navigate }: { material: Material; data: AppData; index: number; navigate: (page: Page, id?: string) => void }) {
  const remaining = remainingWeight(material, data.usages)
  const percent = remainingPercent(material, data.usages)
  return <div className={`mounted-card reveal reveal-${Math.min(index + 1, 4)}`}><div className="mounted-card-top"><span className="mounted-label"><span className="live-dot" />MOUNTED</span><button className="icon-button subtle" onClick={() => navigate('material-detail', material.id)}><Icon name="more" size={17} /></button></div><div className="spool-visual"><div className="spool-ring" style={{ '--spool-color': resolveColorHex(material.color, material.colorHex) } as CSSProperties}><div className="spool-hole" /></div><div className="spool-copy"><strong>{material.brand}</strong><h3>{material.name || material.materialType}</h3><span>{material.materialType} · {material.color}</span></div></div><div className="location-line"><Icon name="location" size={14} />{material.currentLocation}<span className="status-separator" /><span>#{material.id.slice(-3).toUpperCase()}</span></div><div className="weight-block"><div className="weight-row"><strong>{formatNumber(remaining)}<small>g</small></strong><span>/ {formatNumber(material.initialWeightG)}g</span><b>{formatNumber(percent, 1)}%</b></div><div className="progress-track"><span className={percent < 20 ? 'is-low' : ''} style={{ width: `${percent}%` }} /></div></div><div className="card-actions"><button className="button button-quiet" onClick={() => navigate('material-detail', material.id)}>详情 <Icon name="arrow" size={14} /></button><button className="button button-outline" onClick={() => navigate('materials')}>耗材管理</button></div></div>
}

function MaterialsPage({ data, navigate, setActionModal }: { data: AppData; navigate: (page: Page, id?: string) => void; setActionModal: (modal: ActionModal) => void }) {
  const [filter, setFilter] = useState<'ALL' | MaterialStatus>('ALL')
  const [query, setQuery] = useState('')
  const filtered = data.materials.filter((material) => (filter === 'ALL' || material.status === filter) && `${material.brand} ${material.name || ''} ${material.materialType} ${material.color} ${material.currentLocation}`.toLowerCase().includes(query.toLowerCase()))
  const filterItems: Array<{ key: 'ALL' | MaterialStatus; label: string }> = [{ key: 'ALL', label: '全部' }, { key: 'MOUNTED', label: '已挂载' }, { key: 'STORED', label: '已存放' }, { key: 'EMPTY', label: '已用完' }]
  return <section className="panel materials-panel"><div className="materials-toolbar"><div className="filter-tabs">{filterItems.map((item) => <button key={item.key} className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>{item.label}<span>{item.key === 'ALL' ? data.materials.length : data.materials.filter((material) => material.status === item.key).length}</span></button>)}</div><label className="search-box"><Icon name="search" size={16} /><input placeholder="搜索品牌、颜色或位置" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="table-wrap"><table className="data-table"><thead><tr><th>耗材</th><th>状态</th><th>当前位置</th><th>剩余重量</th><th>价格 / 单位成本</th><th>更新于</th><th aria-label="操作" /></tr></thead><tbody>{filtered.map((material) => <MaterialRow key={material.id} data={data} material={material} navigate={navigate} setActionModal={setActionModal} />)}</tbody></table>{filtered.length === 0 && <EmptyState title="没有匹配的耗材" action="清除筛选" onAction={() => { setFilter('ALL'); setQuery('') }} compact />}</div></section>
}

function MaterialRow({ data, material, navigate, setActionModal }: { data: AppData; material: Material; navigate: (page: Page, id?: string) => void; setActionModal: (modal: ActionModal) => void }) {
  const remaining = remainingWeight(material, data.usages)
  const percent = remainingPercent(material, data.usages)
  return <tr><td><button className="material-cell" onClick={() => navigate('material-detail', material.id)}><span className="mini-swatch" style={{ background: resolveColorHex(material.color, material.colorHex) }} /><span><strong>{material.brand} {material.name || material.materialType}</strong><small>{material.materialType} · {material.color} · {formatNumber(material.initialWeightG)}g</small></span></button></td><td><StatusBadge status={material.status} /></td><td><span className="location-cell"><Icon name="location" size={14} />{material.currentLocation}</span></td><td><div className="table-weight"><span>{formatNumber(remaining)}g</span><small>{formatNumber(percent, 1)}%</small><div className="progress-track"><span className={percent < 20 ? 'is-low' : ''} style={{ width: `${percent}%` }} /></div></div></td><td><span className="price-cell">¥{material.price.toFixed(2)}</span><small className="unit-cost">¥{unitCost(material).toFixed(3)} / g</small></td><td><span className="date-cell">{relativeDate(material.updatedAt)}</span></td><td><div className="row-actions"><button className="icon-button subtle" title="查看详情" onClick={() => navigate('material-detail', material.id)}><Icon name="external" size={16} /></button>{material.status === 'STORED' && <button className="small-action" onClick={() => setActionModal({ action: 'mount', material })}>挂载</button>}{material.status === 'MOUNTED' && <button className="small-action" onClick={() => setActionModal({ action: 'unmount', material })}>卸下</button>}{material.status !== 'EMPTY' && <button className="icon-button subtle danger-hover" title="标记用完" onClick={() => setActionModal({ action: 'empty', material })}><Icon name="empty" size={16} /></button>}</div></td></tr>
}

function AddMaterialPage({ onCancel, onCreated }: { onCancel: () => void; onCreated: (input: MaterialInput) => void }) {
  const [form, setForm] = useState<MaterialInput>({ brand: '', materialType: 'PLA', name: '', color: '', colorCategory: 'STANDARD', initialWeightG: 1000, price: 0, currentLocation: 'AMS A1', note: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof MaterialInput, string>>>({})
  const set = (key: keyof MaterialInput, value: string | number) => setForm((current) => ({ ...current, [key]: value }))
  const changeColorCategory = (colorCategory: MaterialColorCategory) => setForm((current) => ({
    ...current,
    colorCategory,
    color: '',
    colorHex: colorCategory === 'CUSTOM' ? (current.colorHex || '#D9D1C5') : undefined,
    pantoneCode: colorCategory === 'CUSTOM' ? current.pantoneCode : undefined,
  }))
  const selectColor = (option: ColorOption) => setForm((current) => ({ ...current, color: option.label, colorHex: option.hex, pantoneCode: undefined }))
  const setCustomCode = (code: string) => setForm((current) => ({ ...current, color: code, pantoneCode: code, colorCategory: 'CUSTOM' }))
  const setDisplayColor = (colorHexValue: string) => setForm((current) => ({ ...current, colorHex: colorHexValue, colorCategory: 'CUSTOM' }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateMaterial(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onCreated(form)
  }
  return <form className="form-layout" noValidate onSubmit={submit}>
    <div className="form-main panel">
      <div className="form-section">
        <div className="form-section-title"><span>01</span><div><h2>基础信息</h2><p>记录这卷耗材的身份信息，之后无需重复录入。</p></div></div>
        <div className="form-grid">
          <Field label="品牌" required error={errors.brand}><input value={form.brand} onChange={(event) => set('brand', event.target.value)} placeholder="例如 Bambu Lab" /></Field>
          <Field label="材料类型" required error={errors.materialType}><select value={form.materialType} onChange={(event) => set('materialType', event.target.value)}><option>PLA</option><option>PLA+</option><option>PETG</option><option>TPU</option><option>ABS</option><option>ASA</option><option>其他</option></select></Field>
          <Field label="具体名称"><input value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="例如 Basic / Silk（可选）" /></Field>
          <div className="color-field"><Field label="颜色" required error={errors.color}><ColorSelection value={form} onCategoryChange={changeColorCategory} onColorSelect={selectColor} onCustomCodeChange={setCustomCode} onDisplayColorChange={setDisplayColor} /></Field></div>
        </div>
      </div>
      <div className="form-section">
        <div className="form-section-title"><span>02</span><div><h2>重量与成本</h2><p>后续成本按实际消耗和这卷耗材的单位成本计算。</p></div></div>
        <div className="form-grid">
          <Field label="初始耗材净重" required suffix="g" error={errors.initialWeightG}><input type="number" min="0" max="10000" step="0.1" value={form.initialWeightG} onChange={(event) => set('initialWeightG', Number(event.target.value))} /></Field>
          <Field label="购入价格" required suffix="CNY" error={errors.price}><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => set('price', Number(event.target.value))} /></Field>
        </div>
        <div className="calculation-hint"><Icon name="cost" size={16} /><span>单位成本将自动计算为</span><strong>¥{form.initialWeightG > 0 ? (form.price / form.initialWeightG).toFixed(3) : '0.000'} / g</strong></div>
      </div>
      <div className="form-section">
        <div className="form-section-title"><span>03</span><div><h2>当前位置</h2><p>如果现在就挂到机器上，记录它所在的料架或 AMS 槽位。</p></div></div>
        <div className="form-grid"><Field label="当前位置" required error={errors.currentLocation}><input value={form.currentLocation} onChange={(event) => set('currentLocation', event.target.value)} placeholder="例如 AMS A1" /></Field><Field label="备注"><input value={form.note} onChange={(event) => set('note', event.target.value)} placeholder="可选，例如用于模型系列" /></Field></div>
      </div>
    </div>
    <aside className="form-aside">
      <div className="preview-card"><div className="preview-label">NEW MATERIAL</div><div className="preview-spool" style={{ '--spool-color': resolveColorHex(form.color, form.colorHex) } as React.CSSProperties}><div className="spool-ring"><div className="spool-hole" /></div></div><div className="preview-name"><strong>{form.brand || '品牌名称'}</strong><h3>{form.name || form.materialType || '材料名称'}</h3><span>{form.color || '未填写颜色'}</span></div><div className="preview-divider" /><div className="preview-stat"><span>初始重量</span><strong>{formatNumber(form.initialWeightG)}g</strong></div><div className="preview-stat"><span>购入价格</span><strong>¥{form.price.toFixed(2)}</strong></div><div className="preview-stat"><span>挂载位置</span><strong>{form.currentLocation || '—'}</strong></div></div>
      <div className="info-tip"><Icon name="roll" size={16} /><span>录入后，这卷耗材会保持为一条独立记录。卸下再挂载时，不需要重新录入基础信息。</span></div>
    </aside>
    <div className="form-footer"><button type="button" className="button button-quiet" onClick={onCancel}>取消</button><button type="submit" className="button button-primary button-with-icon"><Icon name="check" size={16} />保存并挂载</button></div>
  </form>
}

function ColorSelection({ value, onCategoryChange, onColorSelect, onCustomCodeChange, onDisplayColorChange }: { value: MaterialInput; onCategoryChange: (category: MaterialColorCategory) => void; onColorSelect: (option: ColorOption) => void; onCustomCodeChange: (code: string) => void; onDisplayColorChange: (colorHexValue: string) => void }) {
  const options = value.colorCategory === 'METALLIC' ? metallicColors : standardColors
  const displayColor = value.colorHex || '#D9D1C5'
  return <div className="color-selection">
    <div className="color-category-tabs" role="tablist" aria-label="颜色分类">{colorCategoryItems.map((category) => <button type="button" role="tab" aria-selected={value.colorCategory === category.key} className={value.colorCategory === category.key ? 'selected' : ''} key={category.key} onClick={() => onCategoryChange(category.key)}>{category.label}</button>)}</div>
    {value.colorCategory === 'CUSTOM' ? <div className="custom-color-editor"><div className="custom-color-code"><span>潘通 / 自定义色号</span><input value={value.pantoneCode || ''} onChange={(event) => onCustomCodeChange(event.target.value)} placeholder="例如 PANTONE 186 C" /></div><div className="display-color-picker"><span>网页展示色</span><div><input aria-label="网页展示颜色" type="color" value={displayColor} onChange={(event) => onDisplayColorChange(event.target.value)} /><code>{displayColor.toUpperCase()}</code></div></div><p>色号用于记录；网页展示色仅用于本页面显示，不代表 Pantone 与 HEX 精确等价。</p></div> : <div className="color-option-grid">{options.map((option) => <button type="button" className={`color-option ${value.color === option.label ? 'selected' : ''}`} key={option.label} aria-label={`选择${option.label}`} aria-pressed={value.color === option.label} onClick={() => onColorSelect(option)}><span className="color-option-swatch" style={{ background: option.hex }} /><span>{option.label}</span></button>)}</div>}
    <div className="selected-color"><span className="input-swatch" style={{ background: resolveColorHex(value.color, value.colorHex) }} /><span>当前选择：{value.color || '未选择颜色'}</span></div>
  </div>
}

function StartPrintPage({ data, onCancel, onStarted, onError }: { data: AppData; onCancel: () => void; onStarted: (data: AppData, id: string) => void; onError: (error: unknown) => void }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const mounted = data.materials.filter((material) => material.status === 'MOUNTED')
  const [selections, setSelections] = useState<Array<{ materialId: string; estimatedWeightG: number }>>([{ materialId: mounted[0]?.id || '', estimatedWeightG: 0 }])
  const addSelection = () => setSelections((current) => [...current, { materialId: mounted.find((item) => !current.some((selection) => selection.materialId === item.id))?.id || '', estimatedWeightG: 0 }])
  const updateSelection = (index: number, key: 'materialId' | 'estimatedWeightG', value: string | number) => setSelections((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      const next = printApi.start(data, name, note, selections).data
      onStarted(next, next.printJobs[0].id)
    } catch (error) { onError(error) }
  }
  return <form className="print-start-layout" onSubmit={submit}><div className="form-main panel"><div className="print-intro"><div className="print-number">03</div><div><h2>建立一个打印任务</h2><p>预计重量只用于事前提醒，不会扣减剩余量。结束打印时录入实际消耗，才会正式计入。</p></div></div><div className="field-stack"><Field label="打印任务名称" required><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：皮卡丘桌面摆件" /></Field><Field label="备注"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选，记录层高、版本或特殊情况" rows={3} /></Field></div><div className="usage-section"><div className="usage-heading"><div><div className="section-kicker">MATERIAL USAGE</div><h2>这次会用到哪些耗材？</h2><p>可以添加多卷耗材，适用于多色或多材料打印。</p></div><span className="usage-count">{selections.length} 种</span></div><div className="usage-list">{selections.map((selection, index) => <UsageInput key={`${index}-${selection.materialId}`} index={index} selection={selection} data={data} selections={selections} onUpdate={updateSelection} onRemove={() => setSelections((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}</div><button type="button" className="add-usage" onClick={addSelection} disabled={selections.length >= mounted.length}><span><Icon name="plus" size={16} /></span>添加另一种耗材</button></div></div><aside className="print-aside"><div className="print-check-card"><div className="section-kicker">BEFORE YOU START</div><h3>开始前检查</h3><div className="check-list"><div><span className="check-bullet"><Icon name="check" size={13} /></span><span>只会记录预计消耗</span></div><div><span className="check-bullet"><Icon name="check" size={13} /></span><span>实际消耗在结束时确认</span></div><div><span className="check-bullet"><Icon name="check" size={13} /></span><span>一卷耗材可以反复挂载</span></div></div></div><div className="remaining-summary"><div className="section-kicker">SELECTED WEIGHT</div><div className="summary-big">{formatNumber(selections.reduce((sum, selection) => sum + (Number(selection.estimatedWeightG) || 0), 0))}<small>g 预计总量</small></div><div className="summary-note">{selections.filter((selection) => selection.materialId).length} 卷耗材参与本次打印</div></div></aside><div className="form-footer"><button type="button" className="button button-quiet" onClick={onCancel}>取消</button><button type="submit" className="button button-primary button-with-icon"><Icon name="play" size={14} />开始打印</button></div></form>
}

function UsageInput({ index, selection, data, selections, onUpdate, onRemove }: { index: number; selection: { materialId: string; estimatedWeightG: number }; data: AppData; selections: Array<{ materialId: string; estimatedWeightG: number }>; onUpdate: (index: number, key: 'materialId' | 'estimatedWeightG', value: string | number) => void; onRemove: () => void }) {
  const material = data.materials.find((item) => item.id === selection.materialId)
  const remaining = material ? remainingWeight(material, data.usages) : 0
  const insufficient = material && Number(selection.estimatedWeightG) > remaining
  return <div className={`usage-row ${insufficient ? 'has-warning' : ''}`}><div className="usage-index">0{index + 1}</div><div className="usage-material-select"><label>耗材</label><select value={selection.materialId} onChange={(event) => onUpdate(index, 'materialId', event.target.value)}><option value="">选择已挂载耗材</option>{data.materials.filter((item) => item.status === 'MOUNTED' && (item.id === selection.materialId || !selections.some((other, otherIndex) => otherIndex !== index && other.materialId === item.id))).map((item) => <option value={item.id} key={item.id}>{item.brand} {item.name || item.materialType} · {item.color} · {item.currentLocation}</option>)}</select>{material && <span className="available-note">当前剩余 <strong>{formatNumber(remaining)}g</strong></span>}</div><div className="usage-weight-input"><label>预计消耗</label><div className="number-input"><input type="number" min="0" step="0.1" value={selection.estimatedWeightG} onChange={(event) => onUpdate(index, 'estimatedWeightG', Number(event.target.value))} /><span>g</span></div>{insufficient && <span className="inline-warning"><Icon name="warning" size={13} />预计耗材不足</span>}</div><button type="button" className="remove-usage" title="移除" onClick={onRemove} disabled={selections.length === 1}><Icon name="close" size={16} /></button></div>
}

function PrintingDetailPage({ data, job, navigate }: { data: AppData; job: PrintJob; navigate: (page: Page, id?: string) => void }) {
  const usages = data.usages.filter((usage) => usage.printJobId === job.id)
  return <div className="detail-layout"><section className="detail-main panel"><div className="detail-status-row"><StatusBadge status={job.status} /><span className="detail-id">{job.id.slice(-8).toUpperCase()}</span></div><h2 className="detail-title">{job.name}</h2><div className="detail-meta-row"><span><Icon name="calendar" size={15} />开始于 {formatDateTime(job.startedAt)}</span><span><Icon name="clock" size={15} />已进行 {elapsed(job.startedAt)}</span></div><div className="live-banner"><span className="live-pulse"><span /></span><div><strong>任务进行中</strong><span>打印完成后，回到这里记录每种耗材的实际消耗。</span></div><Icon name="play" size={18} /></div><div className="detail-section"><div className="section-heading"><div><div className="section-kicker">MATERIAL USAGE</div><h2>本次使用的耗材</h2></div><span className="section-count">{usages.length} 种</span></div><div className="detail-usage-list">{usages.map((usage) => { const material = data.materials.find((item) => item.id === usage.materialId)!; const remaining = remainingWeight(material, data.usages); return <div className="detail-usage-row" key={usage.id}><span className="detail-color-swatch" style={{ background: resolveColorHex(material.color, material.colorHex) }} /><div className="detail-usage-name"><strong>{material.brand} {material.name || material.materialType}</strong><span>{material.materialType} · {material.color} · {material.currentLocation}</span></div><div className="detail-usage-stat"><span>预计消耗</span><strong>{formatNumber(usage.estimatedWeightG)}g</strong></div><div className="detail-usage-stat"><span>当前剩余</span><strong>{formatNumber(remaining)}g</strong></div></div> })}</div></div></section><aside className="detail-side"><div className="finish-cta"><div className="section-kicker">READY WHEN YOU ARE</div><h3>打印完成了吗？</h3><p>录入实际消耗后，系统会自动更新每卷耗材的剩余重量和成本。</p><button className="button button-primary button-full" onClick={() => navigate('finish-print', job.id)}>结束打印 <Icon name="arrow" size={15} /></button></div><div className="note-card"><span className="note-card-icon"><Icon name="warning" size={16} /></span><div><strong>预计值不会扣减库存</strong><p>只有结束时填写的实际消耗才会影响剩余重量。</p></div></div></aside></div>
}

function FinishPrintPage({ data, job, onCancel, onFinished, onError }: { data: AppData; job: PrintJob; onCancel: () => void; onFinished: (next: AppData) => void; onError: (error: unknown) => void }) {
  const usages = data.usages.filter((usage) => usage.printJobId === job.id)
  const [inputs, setInputs] = useState<FinishInput[]>(() => usages.map((usage) => ({ usageId: usage.id, actualWeightG: defaultActualWeightG('COMPLETED', usage.estimatedWeightG) })))
  const [status, setStatus] = useState<Exclude<PrintJobStatus, 'PRINTING'>>('COMPLETED')
  const [saved, setSaved] = useState(false)
  const update = (usageId: string, value: number | null) => setInputs((current) => current.map((input) => input.usageId === usageId ? { ...input, actualWeightG: value } : input))
  const changeStatus = (nextStatus: Exclude<PrintJobStatus, 'PRINTING'>) => {
    if (nextStatus === status) return
    setStatus(nextStatus)
    setInputs(usages.map((usage) => ({ usageId: usage.id, actualWeightG: defaultActualWeightG(nextStatus, usage.estimatedWeightG) })))
  }
  const previewTotals = useMemo(() => {
    const estimated = round2(usages.reduce((sum, usage) => sum + usage.estimatedWeightG, 0))
    const actual = round2(inputs.reduce((sum, input) => sum + (input.actualWeightG ?? 0), 0))
    const difference = round2(actual - estimated)
    return { estimated, actual, difference, percent: estimated ? round2(difference / estimated * 100) : null }
  }, [inputs, usages])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try { onFinished(printApi.finish(data, job.id, status, inputs).data); setSaved(true) } catch (error) { onError(error) }
  }
  if (saved) {
    const finishedData = { ...data, printJobs: data.printJobs.map((item) => item.id === job.id ? { ...item, status, finishedAt: new Date().toISOString() } : item), usages: data.usages.map((usage) => { const input = inputs.find((item) => item.usageId === usage.id); return input ? { ...usage, actualWeightG: input.actualWeightG } : usage }) }
    const totals = jobTotals(job.id, finishedData.usages, finishedData.materials)
    return <div className="completion-wrap"><div className="completion-mark"><Icon name="check" size={26} /></div><div className="section-kicker">PRINT {status === 'COMPLETED' ? 'COMPLETED' : status}</div><h2>这次打印，记录好了。</h2><p>{job.name} 的耗材消耗已写入历史，相关耗材剩余量也已更新。</p><div className="completion-card panel"><SummaryStat label="预计耗材" value={`${formatNumber(totals.estimated)}g`} /><SummaryStat label="实际耗材" value={`${formatNumber(totals.actual)}g`} /><SummaryStat label="偏差" value={`${totals.difference > 0 ? '+' : ''}${formatNumber(totals.difference)}g`} tone={totals.difference > 0 ? 'coral' : 'green'} /><SummaryStat label="总耗材成本" value={`¥${totals.cost.toFixed(2)}`} tone="yellow" /></div><div className="completion-actions"><button className="button button-quiet" onClick={onCancel}>返回任务</button><button className="button button-primary" onClick={() => window.location.reload()}>完成</button></div></div>
  }
  return <form className="finish-layout" onSubmit={submit}><div className="form-main panel"><div className="finish-heading"><div className="finish-heading-icon"><Icon name="check" size={21} /></div><div><div className="section-kicker">FINAL USAGE</div><h2>{job.name}</h2><p>请称量或估算每卷耗材的实际消耗。提交后将不能直接修改。</p></div></div><div className="finish-table"><div className="finish-table-head"><span>耗材</span><span>预计消耗</span><span>实际消耗</span></div>{usages.map((usage) => { const material = data.materials.find((item) => item.id === usage.materialId)!; const remaining = remainingWeight(material, data.usages); return <div className="finish-row" key={usage.id}><div className="finish-material"><span className="detail-color-swatch" style={{ background: resolveColorHex(material.color, material.colorHex) }} /><div><strong>{material.brand} {material.name || material.materialType}</strong><span>{material.color} · 剩余 {formatNumber(remaining)}g</span></div></div><span className="finish-estimated">{formatNumber(usage.estimatedWeightG)}g</span><div className="finish-actual"><div className="number-input"><input type="number" min="0" step="0.1" value={inputs.find((input) => input.usageId === usage.id)?.actualWeightG ?? ''} onChange={(event) => update(usage.id, event.target.value === '' ? null : Number(event.target.value))} /><span>g</span></div></div></div> })}</div><div className="final-status"><div><strong>最终状态</strong><span>切换状态时会重新生成对应的默认实际消耗，你仍可以手工修改。</span></div><div className="status-selector">{(['COMPLETED', 'FAILED', 'CANCELLED'] as const).map((item) => <button type="button" key={item} className={status === item ? `selected ${item.toLowerCase()}` : ''} onClick={() => changeStatus(item)}>{item === 'COMPLETED' ? '完成' : item === 'FAILED' ? '失败' : '取消'}</button>)}</div></div></div><aside className="finish-side"><div className="live-summary panel"><div className="section-kicker">LIVE SUMMARY</div><h3>本次核算</h3><SummaryLine label="预计总重量" value={`${formatNumber(previewTotals.estimated)}g`} /><SummaryLine label="实际总重量" value={`${formatNumber(previewTotals.actual)}g`} /><div className="summary-divider" /><SummaryLine label="重量偏差" value={`${previewTotals.difference > 0 ? '+' : ''}${formatNumber(previewTotals.difference)}g`} emphasis={previewTotals.difference > 0 ? 'coral' : 'green'} /><SummaryLine label="偏差率" value={previewTotals.percent === null ? '—' : `${previewTotals.percent > 0 ? '+' : ''}${formatNumber(previewTotals.percent)}%`} emphasis={previewTotals.percent !== null && previewTotals.percent > 0 ? 'coral' : 'green'} /></div><div className="calculation-note"><Icon name="cost" size={16} /><span>提交后将按各卷耗材的单位成本分别计算，再汇总成本。</span></div></aside><div className="form-footer"><button type="button" className="button button-quiet" onClick={onCancel}>返回打印中</button><button type="submit" className="button button-primary button-with-icon"><Icon name="check" size={16} />保存实际消耗</button></div></form>
}

function HistoryPage({ data, navigate }: { data: AppData; navigate: (page: Page, id?: string) => void }) {
  const [filter, setFilter] = useState<'ALL' | PrintJobStatus>('ALL')
  const jobs = data.printJobs.filter((job) => job.status !== 'PRINTING' && (filter === 'ALL' || job.status === filter))
  return <section className="panel history-panel"><div className="history-toolbar"><div className="filter-tabs"><button className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}>全部 <span>{data.printJobs.filter((job) => job.status !== 'PRINTING').length}</span></button><button className={filter === 'COMPLETED' ? 'active' : ''} onClick={() => setFilter('COMPLETED')}>完成 <span>{data.printJobs.filter((job) => job.status === 'COMPLETED').length}</span></button><button className={filter === 'FAILED' ? 'active' : ''} onClick={() => setFilter('FAILED')}>失败 <span>{data.printJobs.filter((job) => job.status === 'FAILED').length}</span></button><button className={filter === 'CANCELLED' ? 'active' : ''} onClick={() => setFilter('CANCELLED')}>取消 <span>{data.printJobs.filter((job) => job.status === 'CANCELLED').length}</span></button></div><button className="filter-button"><Icon name="filter" size={16} />筛选</button></div><div className="history-list">{jobs.map((job) => <HistoryRow key={job.id} job={job} data={data} onClick={() => navigate('job-detail', job.id)} />)}{jobs.length === 0 && <EmptyState title="没有符合条件的记录" action="显示全部" onAction={() => setFilter('ALL')} compact />}</div></section>
}

function HistoryRow({ job, data, onClick }: { job: PrintJob; data: AppData; onClick: () => void }) {
  const totals = jobTotals(job.id, data.usages, data.materials)
  const usages = data.usages.filter((usage) => usage.printJobId === job.id)
  const firstMaterial = data.materials.find((material) => material.id === usages[0]?.materialId)
  return <button className="history-row" onClick={onClick}><span className="history-date"><strong>{formatDate(job.finishedAt || job.startedAt, true)}</strong><small>{formatTime(job.finishedAt || job.startedAt)}</small></span><span className="history-job"><strong>{job.name}</strong><span>{usages.map((usage) => data.materials.find((material) => material.id === usage.materialId)?.color).filter(Boolean).join(' · ')}{job.note ? ` · ${job.note}` : ''}</span></span><span className="history-col"><StatusBadge status={job.status} /></span><span className="history-col"><strong>{formatNumber(totals.estimated)}g</strong><small>预计</small></span><span className="history-col"><strong>{formatNumber(totals.actual)}g</strong><small>实际</small></span><span className="history-col cost-col"><strong>¥{totals.cost.toFixed(2)}</strong><small>{firstMaterial?.brand || '多卷耗材'}</small></span><Icon name="chevron" size={17} /></button>
}

function JobDetailPage({ data, job, navigate }: { data: AppData; job: PrintJob; navigate: (page: Page, id?: string) => void }) {
  const usages = data.usages.filter((usage) => usage.printJobId === job.id)
  const totals = jobTotals(job.id, data.usages, data.materials)
  return <div className="detail-layout"><section className="detail-main panel"><div className="detail-status-row"><StatusBadge status={job.status} /><span className="detail-id">{job.id.slice(-8).toUpperCase()}</span></div><h2 className="detail-title">{job.name}</h2>{job.note && <p className="job-note">“{job.note}”</p>}<div className="detail-meta-row"><span><Icon name="calendar" size={15} />开始于 {formatDateTime(job.startedAt)}</span>{job.finishedAt && <span><Icon name="check" size={15} />结束于 {formatDateTime(job.finishedAt)}</span>}</div><div className="detail-section"><div className="section-heading"><div><div className="section-kicker">MATERIAL USAGE</div><h2>耗材明细</h2></div><span className="section-count">{usages.length} 种</span></div><div className="detail-usage-list">{usages.map((usage) => { const material = data.materials.find((item) => item.id === usage.materialId)!; return <div className="detail-usage-row" key={usage.id}><span className="detail-color-swatch" style={{ background: resolveColorHex(material.color, material.colorHex) }} /><div className="detail-usage-name"><strong>{material.brand} {material.name || material.materialType}</strong><span>{material.materialType} · {material.color}</span></div><div className="detail-usage-stat"><span>预计消耗</span><strong>{formatNumber(usage.estimatedWeightG)}g</strong></div><div className="detail-usage-stat"><span>实际消耗</span><strong>{formatNumber(usage.actualWeightG || 0)}g</strong></div><div className="detail-usage-stat cost-stat"><span>成本</span><strong>¥{(usage.actualWeightG === null ? 0 : (usage.actualWeightG * unitCost(material))).toFixed(2)}</strong></div></div> })}</div></div></section><aside className="detail-side"><div className="result-summary panel"><div className="section-kicker">PRINT SUMMARY</div><h3>耗材核算</h3><SummaryLine label="预计总重量" value={`${formatNumber(totals.estimated)}g`} /><SummaryLine label="实际总重量" value={`${formatNumber(totals.actual)}g`} /><SummaryLine label="重量偏差" value={`${totals.difference > 0 ? '+' : ''}${formatNumber(totals.difference)}g`} emphasis={totals.difference > 0 ? 'coral' : 'green'} /><SummaryLine label="偏差率" value={totals.differencePercent === null ? '—' : `${totals.differencePercent > 0 ? '+' : ''}${formatNumber(totals.differencePercent)}%`} /><div className="summary-divider" /><SummaryLine label="总耗材成本" value={`¥${totals.cost.toFixed(2)}`} emphasis="yellow" /></div><button className="back-link" onClick={() => navigate('history')}><Icon name="back" size={15} />返回打印记录</button></aside></div>
}

function MaterialDetailPage({ data, material, navigate, setActionModal }: { data: AppData; material: Material; navigate: (page: Page, id?: string) => void; setActionModal: (modal: ActionModal) => void }) {
  const remaining = remainingWeight(material, data.usages)
  const percent = remainingPercent(material, data.usages)
  const usages = data.usages.filter((usage) => usage.materialId === material.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <div className="material-detail-layout"><div className="detail-back"><button className="back-link" onClick={() => navigate('materials')}><Icon name="back" size={15} />返回耗材列表</button></div><section className="material-hero panel"><div className="material-hero-visual"><div className="big-spool" style={{ '--spool-color': resolveColorHex(material.color, material.colorHex) } as React.CSSProperties}><div className="big-spool-hole" /></div></div><div className="material-hero-copy"><div className="detail-status-row"><StatusBadge status={material.status} /><span className="detail-id">{material.id.slice(-8).toUpperCase()}</span></div><div className="eyebrow">{material.brand}</div><h2>{material.name || material.materialType}</h2><p>{material.materialType} · {material.color}</p><div className="hero-location"><Icon name="location" size={15} />{material.currentLocation}</div></div><div className="hero-actions">{material.status === 'MOUNTED' && <button className="button button-outline" onClick={() => setActionModal({ action: 'unmount', material })}>卸下耗材</button>}{material.status === 'STORED' && <button className="button button-primary" onClick={() => setActionModal({ action: 'mount', material })}>挂载耗材</button>}</div></section><section className="material-stats-grid"><div className="material-stat-card"><span>当前剩余</span><strong>{formatNumber(remaining)}<small>g</small></strong><div className="large-progress"><span style={{ width: `${percent}%` }} /></div><b>{formatNumber(percent, 1)}% 剩余</b></div><div className="material-stat-card"><span>初始重量</span><strong>{formatNumber(material.initialWeightG)}<small>g</small></strong><b>净重</b></div><div className="material-stat-card"><span>购入价格</span><strong>¥{material.price.toFixed(2)}</strong><b>整卷价格</b></div><div className="material-stat-card"><span>单位成本</span><strong>¥{unitCost(material).toFixed(3)}<small>/g</small></strong><b>按实际消耗计算</b></div></section><section className="panel material-history-panel"><div className="panel-heading"><div><div className="section-kicker">USAGE HISTORY</div><h2>打印使用记录</h2></div><span className="section-count">{usages.length} 次使用</span></div>{usages.length ? <div className="material-history-list">{usages.map((usage) => { const job = data.printJobs.find((item) => item.id === usage.printJobId)!; return <button className="material-history-row" key={usage.id} onClick={() => navigate('job-detail', job.id)}><span className="history-date"><strong>{formatDate(job.finishedAt || job.startedAt, true)}</strong><small>{formatTime(job.finishedAt || job.startedAt)}</small></span><span className="material-history-job"><strong>{job.name}</strong><span>{job.status === 'PRINTING' ? '进行中' : '已完成记录'}</span></span><span className="history-col"><strong>{formatNumber(usage.estimatedWeightG)}g</strong><small>预计</small></span><span className="history-col"><strong>{usage.actualWeightG === null ? '—' : `${formatNumber(usage.actualWeightG)}g`}</strong><small>实际</small></span><span className="history-col cost-col"><strong>¥{usage.actualWeightG === null ? '0.00' : (usage.actualWeightG * unitCost(material)).toFixed(2)}</strong><small>耗材成本</small></span><Icon name="chevron" size={17} /></button> })}</div> : <EmptyState title="这卷耗材还没有打印记录" action="开始打印" onAction={() => navigate('start-print')} compact />}</section></div>
}

function StatusModal({ action, material, data, onClose, onConfirm }: { action: ActionModal['action']; material: Material; data: AppData; onClose: () => void; onConfirm: (action: ActionModal['action'], location?: string) => void }) {
  const [location, setLocation] = useState(action === 'mount' ? material.currentLocation.replace(/干燥箱|储物柜/g, 'AMS') : material.currentLocation)
  const isEmpty = action === 'empty'
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal"><button className="modal-close" onClick={onClose}><Icon name="close" size={18} /></button><div className={`modal-icon modal-icon-${action}`}><Icon name={action === 'mount' ? 'mount' : action === 'unmount' ? 'unmount' : 'empty'} size={21} /></div><div className="section-kicker">{action === 'mount' ? 'MOUNT MATERIAL' : action === 'unmount' ? 'STORE MATERIAL' : 'MARK EMPTY'}</div><h2>{action === 'mount' ? '挂载已有耗材' : action === 'unmount' ? '卸下并存放' : '标记耗材用完'}</h2><p>{action === 'mount' ? <>选择一个新的位置，把 <strong>{material.brand} {material.name || material.materialType}</strong> 重新挂上。基础信息和剩余重量都会保留。</> : action === 'unmount' ? <>把 <strong>{material.brand} {material.name || material.materialType}</strong> 从当前槽位卸下，剩余重量不会改变。</> : <>确定 <strong>{material.brand} {material.name || material.materialType}</strong> 已经用完吗？这个操作只改变状态，不会新增消耗记录。</>}</p>{!isEmpty && <Field label={action === 'mount' ? '新的挂载位置' : '存放位置'} required><input autoFocus value={location} onChange={(event) => setLocation(event.target.value)} placeholder={action === 'mount' ? '例如 AMS A3' : '例如 干燥箱 A2'} /></Field>}{isEmpty && <div className="modal-warning"><Icon name="warning" size={17} /><span>当前剩余约 {formatNumber(remainingWeight(material, data.usages))}g。若还有剩余，请使用“卸下”而不是标记用完。</span></div>}<div className="modal-actions"><button className="button button-quiet" onClick={onClose}>取消</button><button className={`button ${isEmpty ? 'button-danger' : 'button-primary'}`} onClick={() => onConfirm(action, location)}>{action === 'mount' ? '确认挂载' : action === 'unmount' ? '确认卸下' : '标记用完'}</button></div></div></div>
}

function Field({ label, required, suffix, error, children }: { label: string; required?: boolean; suffix?: string; error?: string; children: ReactNode }) {
  return <label className={`field ${error ? 'has-error' : ''}`}><span className="field-label">{label}{required && <i>*</i>}</span><div className={suffix ? 'field-control has-suffix' : 'field-control'}>{children}{suffix && <span className="field-suffix">{suffix}</span>}</div>{error && <span className="field-error">{error}</span>}</label>
}

function StatusBadge({ status }: { status: MaterialStatus | PrintJobStatus }) {
  const labels: Record<string, string> = { MOUNTED: '已挂载', STORED: '已存放', EMPTY: '已用完', DISABLED: '已停用', PRINTING: '打印中', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }
  return <span className={`status-badge status-${status.toLowerCase()}`}><span />{labels[status]}</span>
}

function SummaryLine({ label, value, emphasis }: { label: string; value: string; emphasis?: 'coral' | 'green' | 'yellow' }) { return <div className="summary-line"><span>{label}</span><strong className={emphasis ? `text-${emphasis}` : ''}>{value}</strong></div> }
function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className="summary-stat"><span>{label}</span><strong className={tone ? `text-${tone}` : ''}>{value}</strong></div> }

function JobListItem({ job, data, onClick }: { job: PrintJob; data: AppData; onClick: () => void }) { const totals = jobTotals(job.id, data.usages, data.materials); return <button className="job-list-item" onClick={onClick}><span className={`job-status-dot dot-${job.status.toLowerCase()}`} /><span className="job-list-copy"><strong>{job.name}</strong><small>{formatDate(job.finishedAt || job.startedAt)} · {data.usages.filter((usage) => usage.printJobId === job.id).length} 种耗材</small></span><span className="job-list-cost">¥{totals.cost.toFixed(2)}</span><Icon name="chevron" size={16} /></button> }
function EmptyState({ title, action, onAction, compact }: { title: string; action: string; onAction: () => void; compact?: boolean }) { return <div className={`empty-state ${compact ? 'compact' : ''}`}><div className="empty-state-icon"><Icon name="roll" size={22} /></div><strong>{title}</strong><button className="text-button" onClick={onAction}>{action} <Icon name="arrow" size={14} /></button></div> }

function formatDate(value: string, withWeekday = false) { const date = new Date(value); return new Intl.DateTimeFormat('zh-CN', withWeekday ? { month: 'short', day: 'numeric', weekday: 'short' } : { month: 'short', day: 'numeric' }).format(date) }
function formatTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) }
function formatDateTime(value: string) { return `${formatDate(value)} ${formatTime(value)}` }
function relativeDate(value: string) { const diff = Date.now() - new Date(value).getTime(); if (diff < 86400000) return '今天'; if (diff < 172800000) return '昨天'; return formatDate(value) }
function elapsed(value: string) { const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` }

export default App
