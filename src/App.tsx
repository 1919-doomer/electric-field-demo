import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { ControlPanel } from './components/ControlPanel'
import { PhysicsCanvas } from './components/PhysicsCanvas'
import {
  CANVAS_DIMENSIONS,
  DEFAULT_DRAFT,
  DEFAULT_LAYERS,
  DEFAULT_SETTINGS,
  EMPTY_DIAGNOSTICS,
  createCharge,
  createDefaultCharges,
  draftForAddMode,
} from './defaults'
import { formatScientific } from './format'
import {
  computeChargeMetrics,
  computeReadoutForProbe,
  magnitude,
  subtract,
  updateSimulationStep,
} from './physics'
import type {
  AddMode,
  Charge,
  ChargeDraft,
  LayerSettings,
  SimulationDiagnostics,
  SimulationSettings,
  Vector2,
} from './types'

type SimulationState = {
  charges: Charge[]
  diagnostics: SimulationDiagnostics
}

function App() {
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS)
  const [layers, setLayers] = useState<LayerSettings>(DEFAULT_LAYERS)
  const [simulation, setSimulation] = useState<SimulationState>(() => ({
    charges: createDefaultCharges(CANVAS_DIMENSIONS),
    diagnostics: EMPTY_DIAGNOSTICS,
  }))
  const [running, setRunning] = useState(false)
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(
    'charge-positive-test',
  )
  const [draggingChargeId, setDraggingChargeId] = useState<string | null>(null)
  const [hoverPoint, setHoverPoint] = useState<Vector2 | null>(null)
  const [addMode, setAddMode] = useState<AddMode>('positive-source')
  const [draft, setDraft] = useState<ChargeDraft>(DEFAULT_DRAFT)

  const charges = simulation.charges

  useEffect(() => {
    if (!running) {
      return
    }

    let frameId = 0
    const tick = () => {
      setSimulation((previous) =>
        updateSimulationState(previous.charges, settings),
      )
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [running, settings])

  const selectedCharge = useMemo(
    () => charges.find((charge) => charge.id === selectedChargeId) ?? null,
    [charges, selectedChargeId],
  )

  const hoveredCharge = useMemo(
    () => (hoverPoint ? findChargeAtPoint(charges, hoverPoint, settings.chargeRadiusPx) : null),
    [charges, hoverPoint, settings.chargeRadiusPx],
  )

  const selectedMetrics = useMemo(
    () =>
      selectedCharge
        ? computeChargeMetrics(selectedCharge, charges, settings)
        : null,
    [charges, selectedCharge, settings],
  )

  const hoverData = useMemo(() => {
    if (!hoverPoint || !layers.mouseProbe) {
      return null
    }

    const readout = computeReadoutForProbe(
      hoverPoint,
      settings.probeChargeMicroC,
      charges,
      settings,
    )

    return {
      ...readout,
      point: hoverPoint,
      physicalPoint: {
        x: hoverPoint.x * settings.metersPerPixel,
        y: hoverPoint.y * settings.metersPerPixel,
      },
      hoveredCharge,
    }
  }, [charges, hoverPoint, hoveredCharge, layers.mouseProbe, settings])

  const heatmapLabel = settings.heatmapAutoRange
    ? '|E|：N/C · log 自动色标'
    : `|E|：0 - ${formatScientific(Math.pow(10, settings.heatmapMaxLog) - 1)} N/C`

  function updateSimulationState(chargesToUpdate: Charge[], currentSettings: SimulationSettings) {
    const result = updateSimulationStep(
      chargesToUpdate,
      currentSettings,
      CANVAS_DIMENSIONS,
    )
    return {
      charges: result.charges,
      diagnostics: result.diagnostics,
    }
  }

  function handlePointerDown(point: Vector2) {
    const hit = findChargeAtPoint(charges, point, settings.chargeRadiusPx)
    if (hit) {
      setSelectedChargeId(hit.id)
      setDraggingChargeId(hit.id)
      return
    }

    const position = clampToCanvas(point, settings.chargeRadiusPx)
    const newCharge = createCharge(position, draft)
    setSimulation((previous) => ({
      ...previous,
      charges: [...previous.charges, newCharge],
    }))
    setSelectedChargeId(newCharge.id)
  }

  function handlePointerMove(point: Vector2) {
    setHoverPoint(point)

    if (!draggingChargeId) {
      return
    }

    const position = clampToCanvas(point, settings.chargeRadiusPx)
    setSimulation((previous) => ({
      ...previous,
      charges: previous.charges.map((charge) =>
        charge.id === draggingChargeId
          ? {
              ...charge,
              position,
              initialPosition: position,
              velocity: { x: 0, y: 0 },
              stopped: false,
              trail: [],
            }
          : charge,
      ),
    }))
  }

  function handlePointerUp() {
    setDraggingChargeId(null)
  }

  function handlePointerLeave() {
    if (!draggingChargeId) {
      setHoverPoint(null)
    }
  }

  function handleAddModeChange(mode: AddMode) {
    setAddMode(mode)
    setDraft((previous) => draftForAddMode(mode, previous))
  }

  function handleDraftChange(patch: Partial<ChargeDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }))
  }

  function handleSelectedChargeChange(patch: Partial<ChargeDraft>) {
    if (!selectedChargeId) {
      return
    }

    setSimulation((previous) => ({
      ...previous,
      charges: previous.charges.map((charge) => {
        if (charge.id !== selectedChargeId) {
          return charge
        }

        const fixed = patch.fixed ?? charge.fixed

        return {
          ...charge,
          ...patch,
          fixed,
          velocity: fixed ? { x: 0, y: 0 } : charge.velocity,
          stopped: false,
        }
      }),
    }))
  }

  function handleLayerChange(patch: Partial<LayerSettings>) {
    setLayers((previous) => ({ ...previous, ...patch }))
  }

  function handleSettingsChange(patch: Partial<SimulationSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }))
  }

  function handleStep() {
    setSimulation((previous) => updateSimulationState(previous.charges, settings))
  }

  function handleResetSimulation() {
    setRunning(false)
    setSimulation((previous) => ({
      charges: previous.charges.map((charge) => ({
        ...charge,
        position: { ...charge.initialPosition },
        velocity: { x: 0, y: 0 },
        stopped: false,
        trail: [],
      })),
      diagnostics: EMPTY_DIAGNOSTICS,
    }))
  }

  function handleClearCharges() {
    setRunning(false)
    setSelectedChargeId(null)
    setSimulation({
      charges: [],
      diagnostics: EMPTY_DIAGNOSTICS,
    })
  }

  function handleClearTrails() {
    setSimulation((previous) => ({
      ...previous,
      charges: previous.charges.map((charge) => ({ ...charge, trail: [] })),
    }))
  }

  function handleDeleteSelected() {
    if (!selectedChargeId) {
      return
    }

    setSimulation((previous) => ({
      ...previous,
      charges: previous.charges.filter((charge) => charge.id !== selectedChargeId),
    }))
    setSelectedChargeId(null)
  }

  return (
    <main className="app-shell">
      <ControlPanel
        addMode={addMode}
        draft={draft}
        selectedCharge={selectedCharge}
        selectedMetrics={selectedMetrics}
        settings={settings}
        layers={layers}
        running={running}
        diagnostics={simulation.diagnostics}
        chargeCount={charges.length}
        onAddModeChange={handleAddModeChange}
        onDraftChange={handleDraftChange}
        onSelectedChargeChange={handleSelectedChargeChange}
        onLayerChange={handleLayerChange}
        onSettingsChange={handleSettingsChange}
        onToggleRunning={() => setRunning((value) => !value)}
        onStep={handleStep}
        onResetSimulation={handleResetSimulation}
        onClearCharges={handleClearCharges}
        onClearTrails={handleClearTrails}
        onDeleteSelected={handleDeleteSelected}
      />

      <PhysicsCanvas
        dimensions={CANVAS_DIMENSIONS}
        charges={charges}
        settings={settings}
        layers={layers}
        selectedChargeId={selectedChargeId}
        hoveredChargeId={hoveredCharge?.id ?? null}
        hoverData={hoverData}
        heatmapLabel={heatmapLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
    </main>
  )
}

function findChargeAtPoint(
  charges: Charge[],
  point: Vector2,
  chargeRadiusPx: number,
): Charge | null {
  return (
    charges
      .slice()
      .reverse()
      .find(
        (charge) =>
          magnitude(subtract(point, charge.position)) <= chargeRadiusPx + 8,
      ) ?? null
  )
}

function clampToCanvas(point: Vector2, radius: number): Vector2 {
  return {
    x: Math.min(Math.max(point.x, radius), CANVAS_DIMENSIONS.width - radius),
    y: Math.min(Math.max(point.y, radius), CANVAS_DIMENSIONS.height - radius),
  }
}

export default App
