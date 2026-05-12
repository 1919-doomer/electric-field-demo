import type {
  AddMode,
  CanvasDimensions,
  Charge,
  ChargeDraft,
  LayerSettings,
  SimulationDiagnostics,
  SimulationSettings,
  Vector2,
} from './types'

export const CANVAS_DIMENSIONS: CanvasDimensions = {
  width: 1000,
  height: 680,
}

export const REAL_COULOMB_K = 8.9875517923e9

export const DEFAULT_SETTINGS: SimulationSettings = {
  metersPerPixel: 0.002,
  coulombK: REAL_COULOMB_K,
  simulationK: REAL_COULOMB_K * 0.02,
  dt: 1 / 60,
  rMinPx: 10,
  chargeRadiusPx: 14,
  testChargesAffectField: false,
  boundaryMode: 'bounce',
  probeChargeMicroC: 1,
  heatmapCellPx: 18,
  vectorGridPx: 52,
  heatmapAutoRange: true,
  heatmapMaxLog: 5,
  fieldLineStepPx: 5,
  fieldLineMaxSteps: 900,
  trailLimit: 600,
  enableSpeedLimit: true,
  speedLimitPxPerS: 520,
  enableAccelerationLimit: true,
  accelerationLimitPxPerS2: 24000,
}

export const DEFAULT_LAYERS: LayerSettings = {
  heatmap: true,
  fieldArrows: true,
  fieldLines: false,
  forceVectors: true,
  velocityVectors: false,
  trails: false,
  mouseProbe: true,
}

export const EMPTY_DIAGNOSTICS: SimulationDiagnostics = {
  speedLimited: false,
  accelerationLimited: false,
  boundaryHits: 0,
}

export const DEFAULT_DRAFT: ChargeDraft = {
  qMicroC: 2,
  massGram: 10,
  fixed: true,
  isSource: true,
  isTest: false,
}

let nextChargeId = 1

export function createChargeId() {
  nextChargeId += 1
  return `charge-${nextChargeId}`
}

export function createCharge(
  position: Vector2,
  draft: ChargeDraft,
  id = createChargeId(),
): Charge {
  return {
    id,
    position: { ...position },
    initialPosition: { ...position },
    velocity: { x: 0, y: 0 },
    qMicroC: draft.qMicroC,
    massGram: draft.massGram,
    fixed: draft.fixed,
    isSource: draft.isSource,
    isTest: draft.isTest,
    trail: [],
    stopped: false,
  }
}

export function draftForAddMode(mode: AddMode, previous: ChargeDraft): ChargeDraft {
  const magnitude = Math.max(0.5, Math.abs(previous.qMicroC || 2))
  const sign = mode.startsWith('positive') ? 1 : -1
  const isSource = mode.endsWith('source')

  return {
    qMicroC: sign * magnitude,
    massGram: previous.massGram,
    fixed: isSource,
    isSource,
    isTest: !isSource,
  }
}

export function createDefaultCharges(dimensions: CanvasDimensions): Charge[] {
  const centerY = dimensions.height / 2

  return [
    createCharge(
      { x: dimensions.width * 0.34, y: centerY },
      {
        qMicroC: 5,
        massGram: 20,
        fixed: true,
        isSource: true,
        isTest: false,
      },
      'charge-positive-source',
    ),
    createCharge(
      { x: dimensions.width * 0.66, y: centerY },
      {
        qMicroC: -5,
        massGram: 20,
        fixed: true,
        isSource: true,
        isTest: false,
      },
      'charge-negative-source',
    ),
    createCharge(
      { x: dimensions.width * 0.5, y: dimensions.height * 0.27 },
      {
        qMicroC: 1.2,
        massGram: 8,
        fixed: false,
        isSource: false,
        isTest: true,
      },
      'charge-positive-test',
    ),
  ]
}
