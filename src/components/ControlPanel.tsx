import {
  Activity,
  Eraser,
  Gauge,
  Layers,
  MousePointer2,
  Pause,
  Play,
  PlusCircle,
  RotateCcw,
  StepForward,
  Trash2,
  Waves,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import {
  formatGram,
  formatMeters,
  formatMicroC,
  formatScientific,
  formatSeconds,
  formatVector,
} from '../format'
import type {
  AddMode,
  Charge,
  ChargeDraft,
  ChargeMetrics,
  LayerSettings,
  SimulationDiagnostics,
  SimulationSettings,
} from '../types'
import { PhysicsNotes } from './PhysicsNotes'

type ControlPanelProps = {
  addMode: AddMode
  draft: ChargeDraft
  selectedCharge: Charge | null
  selectedMetrics: ChargeMetrics | null
  settings: SimulationSettings
  layers: LayerSettings
  running: boolean
  diagnostics: SimulationDiagnostics
  chargeCount: number
  onAddModeChange: (mode: AddMode) => void
  onDraftChange: (patch: Partial<ChargeDraft>) => void
  onSelectedChargeChange: (patch: Partial<ChargeDraft>) => void
  onLayerChange: (patch: Partial<LayerSettings>) => void
  onSettingsChange: (patch: Partial<SimulationSettings>) => void
  onToggleRunning: () => void
  onStep: () => void
  onResetSimulation: () => void
  onClearCharges: () => void
  onClearTrails: () => void
  onDeleteSelected: () => void
}

const ADD_MODE_LABELS: Record<AddMode, string> = {
  'positive-source': '正源电荷',
  'negative-source': '负源电荷',
  'positive-test': '正测试电荷',
  'negative-test': '负测试电荷',
}

const ADD_MODES = Object.keys(ADD_MODE_LABELS) as AddMode[]

export function ControlPanel({
  addMode,
  draft,
  selectedCharge,
  selectedMetrics,
  settings,
  layers,
  running,
  diagnostics,
  chargeCount,
  onAddModeChange,
  onDraftChange,
  onSelectedChargeChange,
  onLayerChange,
  onSettingsChange,
  onToggleRunning,
  onStep,
  onResetSimulation,
  onClearCharges,
  onClearTrails,
  onDeleteSelected,
}: ControlPanelProps) {
  const editable = selectedCharge ?? draft
  const editSelected = Boolean(selectedCharge)
  const rMinMeters = settings.rMinPx * settings.metersPerPixel
  const manualHeatmapMax = Math.pow(10, settings.heatmapMaxLog) - 1

  function updateEditable(patch: Partial<ChargeDraft>) {
    if (editSelected) {
      onSelectedChargeChange(patch)
      return
    }

    onDraftChange(patch)
  }

  return (
    <aside className="control-panel">
      <div className="panel-title">
        <div>
          <h1>二维点电荷电场</h1>
          <p>库仑定律 · 电场叠加 · 半隐式欧拉积分</p>
        </div>
        <span className="charge-count">{chargeCount} 个电荷</span>
      </div>

      <PanelSection title="添加电荷" icon={<PlusCircle size={18} />}>
        <div className="mode-grid">
          {ADD_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={mode === addMode ? 'mode-button active' : 'mode-button'}
              onClick={() => onAddModeChange(mode)}
            >
              {ADD_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <p className="hint">当前添加模式：{ADD_MODE_LABELS[addMode]}。点击画布空白处添加，拖拽圆点移动已有电荷。</p>
      </PanelSection>

      <PanelSection title={editSelected ? '选中电荷' : '新增默认值'} icon={<Zap size={18} />}>
        <div className="edit-target">
          {editSelected && selectedCharge ? (
            <>
              <strong>{formatMicroC(selectedCharge.qMicroC)}</strong>
              <span>
                {selectedCharge.fixed ? '固定' : '可运动'} ·{' '}
                {selectedCharge.isSource ? '源' : '非源'} ·{' '}
                {selectedCharge.isTest ? '测试' : '非测试'}
              </span>
            </>
          ) : (
            <>
              <strong>{formatMicroC(draft.qMicroC)}</strong>
              <span>这些参数会用于下一个新电荷</span>
            </>
          )}
        </div>

        <RangeControl
          label="电荷量 q"
          value={editable.qMicroC}
          min={-10}
          max={10}
          step={0.1}
          display={formatMicroC(editable.qMicroC)}
          onChange={(value) => updateEditable({ qMicroC: value })}
        />
        <RangeControl
          label="质量 m"
          value={editable.massGram}
          min={0.1}
          max={100}
          step={0.1}
          display={formatGram(editable.massGram)}
          onChange={(value) => updateEditable({ massGram: value })}
        />

        <ToggleRow
          label="固定位置"
          checked={editable.fixed}
          onChange={(checked) => updateEditable({ fixed: checked })}
        />
        <ToggleRow
          label="作为源电荷产生电场"
          checked={editable.isSource}
          onChange={(checked) => updateEditable({ isSource: checked })}
        />
        <ToggleRow
          label="作为测试电荷显示受力"
          checked={editable.isTest}
          onChange={(checked) => updateEditable({ isTest: checked })}
        />

        {selectedCharge ? (
          <button type="button" className="danger-button" onClick={onDeleteSelected}>
            <Trash2 size={16} />
            删除选中电荷
          </button>
        ) : null}
      </PanelSection>

      <PanelSection title="模拟控制" icon={<Activity size={18} />}>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={onToggleRunning}>
            {running ? <Pause size={16} /> : <Play size={16} />}
            {running ? '暂停' : '开始'}
          </button>
          <button type="button" className="tool-button" onClick={onStep}>
            <StepForward size={16} />
            单步
          </button>
        </div>
        <div className="button-row">
          <button type="button" className="tool-button" onClick={onResetSimulation}>
            <RotateCcw size={16} />
            重置模拟
          </button>
          <button type="button" className="tool-button" onClick={onClearTrails}>
            <Eraser size={16} />
            清除轨迹
          </button>
        </div>
        <button type="button" className="danger-button" onClick={onClearCharges}>
          <Trash2 size={16} />
          清空电荷
        </button>

        <RangeControl
          label="时间步长 dt"
          value={settings.dt}
          min={0.002}
          max={0.05}
          step={0.001}
          display={formatSeconds(settings.dt)}
          onChange={(value) => onSettingsChange({ dt: value })}
        />
        <RangeControl
          label="最小作用距离 r_min"
          value={settings.rMinPx}
          min={4}
          max={40}
          step={1}
          display={`${settings.rMinPx.toFixed(0)} px = ${formatMeters(rMinMeters)}`}
          onChange={(value) => onSettingsChange({ rMinPx: value })}
        />

        <label className="field-label">
          <span>边界处理</span>
          <select
            value={settings.boundaryMode}
            onChange={(event) =>
              onSettingsChange({
                boundaryMode: event.currentTarget.value as SimulationSettings['boundaryMode'],
              })
            }
          >
            <option value="bounce">反弹</option>
            <option value="stop">穿出停止</option>
            <option value="wrap">环绕</option>
          </select>
        </label>

        <ToggleRow
          label="测试电荷反过来影响其他电荷"
          checked={settings.testChargesAffectField}
          onChange={(checked) => onSettingsChange({ testChargesAffectField: checked })}
        />
        <ToggleRow
          label="启用速度上限"
          checked={settings.enableSpeedLimit}
          onChange={(checked) => onSettingsChange({ enableSpeedLimit: checked })}
        />
        <RangeControl
          label="速度上限"
          value={settings.speedLimitPxPerS}
          min={100}
          max={1400}
          step={20}
          display={`${settings.speedLimitPxPerS.toFixed(0)} px/s`}
          disabled={!settings.enableSpeedLimit}
          onChange={(value) => onSettingsChange({ speedLimitPxPerS: value })}
        />
        <ToggleRow
          label="启用加速度上限"
          checked={settings.enableAccelerationLimit}
          onChange={(checked) => onSettingsChange({ enableAccelerationLimit: checked })}
        />
        <RangeControl
          label="加速度上限"
          value={settings.accelerationLimitPxPerS2}
          min={2000}
          max={80000}
          step={1000}
          display={`${settings.accelerationLimitPxPerS2.toFixed(0)} px/s²`}
          disabled={!settings.enableAccelerationLimit}
          onChange={(value) => onSettingsChange({ accelerationLimitPxPerS2: value })}
        />

        <div className="stability-status">
          <span>数值保护：</span>
          <strong>
            {diagnostics.speedLimited || diagnostics.accelerationLimited
              ? '已触发'
              : '未触发'}
          </strong>
          <small>
            {diagnostics.boundaryHits > 0
              ? `边界碰撞 ${diagnostics.boundaryHits} 次`
              : '上限只用于稳定演示'}
          </small>
        </div>
      </PanelSection>

      <PanelSection title="可视化图层" icon={<Layers size={18} />}>
        <ToggleRow
          label="电场强度热力图"
          checked={layers.heatmap}
          onChange={(checked) => onLayerChange({ heatmap: checked })}
        />
        <ToggleRow
          label="电场方向箭头"
          checked={layers.fieldArrows}
          onChange={(checked) => onLayerChange({ fieldArrows: checked })}
        />
        <ToggleRow
          label="电场线"
          checked={layers.fieldLines}
          onChange={(checked) => onLayerChange({ fieldLines: checked })}
        />
        <ToggleRow
          label="力矢量"
          checked={layers.forceVectors}
          onChange={(checked) => onLayerChange({ forceVectors: checked })}
        />
        <ToggleRow
          label="速度矢量"
          checked={layers.velocityVectors}
          onChange={(checked) => onLayerChange({ velocityVectors: checked })}
        />
        <ToggleRow
          label="轨迹"
          checked={layers.trails}
          onChange={(checked) => onLayerChange({ trails: checked })}
        />
        <ToggleRow
          label="鼠标悬停数据"
          checked={layers.mouseProbe}
          onChange={(checked) => onLayerChange({ mouseProbe: checked })}
        />

        <ToggleRow
          label="场强色标自动范围"
          checked={settings.heatmapAutoRange}
          onChange={(checked) => onSettingsChange({ heatmapAutoRange: checked })}
        />
        <RangeControl
          label="手动色标上限 log10(1 + |E|)"
          value={settings.heatmapMaxLog}
          min={2}
          max={7}
          step={0.1}
          display={`${settings.heatmapMaxLog.toFixed(1)} ≈ ${formatScientific(
            manualHeatmapMax,
          )} N/C`}
          disabled={settings.heatmapAutoRange}
          onChange={(value) => onSettingsChange({ heatmapMaxLog: value })}
        />
      </PanelSection>

      <PanelSection title="鼠标探针" icon={<MousePointer2 size={18} />}>
        <RangeControl
          label="测试电荷量 q_probe"
          value={settings.probeChargeMicroC}
          min={-10}
          max={10}
          step={0.1}
          display={formatMicroC(settings.probeChargeMicroC)}
          onChange={(value) => onSettingsChange({ probeChargeMicroC: value })}
        />
        <p className="hint">悬停读数会显示该探针电荷在当前位置受到的 F = q_probe E。</p>
      </PanelSection>

      {selectedCharge && selectedMetrics ? (
        <PanelSection title="选中电荷读数" icon={<Gauge size={18} />}>
          <MetricRow label="E" value={formatVector(selectedMetrics.field, 'N/C')} />
          <MetricRow
            label="|E|"
            value={`${formatScientific(selectedMetrics.fieldMagnitude)} N/C`}
          />
          <MetricRow label="V" value={`${formatScientific(selectedMetrics.potential)} V`} />
          <MetricRow label="F" value={formatVector(selectedMetrics.force, 'N')} />
          <MetricRow
            label="|F|"
            value={`${formatScientific(selectedMetrics.forceMagnitude)} N`}
          />
          <MetricRow
            label="a"
            value={formatVector(selectedMetrics.acceleration, 'm/s²')}
          />
        </PanelSection>
      ) : null}

      <PanelSection title="单位与常数" icon={<Waves size={18} />}>
        <MetricRow label="比例" value={`1 px = ${settings.metersPerPixel} m`} />
        <MetricRow label="真实 k" value={`${formatScientific(settings.coulombK)} N·m²/C²`} />
        <MetricRow
          label="simulationK"
          value={`${formatScientific(settings.simulationK)} N·m²/C²`}
        />
      </PanelSection>

      <PhysicsNotes />
    </aside>
  )
}

function PanelSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel-section">
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className={disabled ? 'range-control disabled' : 'range-control'}>
      <span className="control-label">
        <span>{label}</span>
        <strong>{display}</strong>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
