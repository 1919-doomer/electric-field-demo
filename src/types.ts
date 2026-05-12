export type Vector2 = {
  x: number
  y: number
}

export type BoundaryMode = 'bounce' | 'stop' | 'wrap'

export type AddMode =
  | 'positive-source'
  | 'negative-source'
  | 'positive-test'
  | 'negative-test'

export type Charge = {
  id: string
  position: Vector2
  initialPosition: Vector2
  velocity: Vector2
  qMicroC: number
  massGram: number
  fixed: boolean
  isSource: boolean
  isTest: boolean
  trail: Vector2[]
  stopped: boolean
}

export type ChargeDraft = Pick<
  Charge,
  'qMicroC' | 'massGram' | 'fixed' | 'isSource' | 'isTest'
>

export type SimulationSettings = {
  metersPerPixel: number
  coulombK: number
  simulationK: number
  dt: number
  rMinPx: number
  chargeRadiusPx: number
  testChargesAffectField: boolean
  boundaryMode: BoundaryMode
  probeChargeMicroC: number
  heatmapCellPx: number
  vectorGridPx: number
  heatmapAutoRange: boolean
  heatmapMaxLog: number
  fieldLineStepPx: number
  fieldLineMaxSteps: number
  trailLimit: number
  enableSpeedLimit: boolean
  speedLimitPxPerS: number
  enableAccelerationLimit: boolean
  accelerationLimitPxPerS2: number
}

export type LayerSettings = {
  heatmap: boolean
  fieldArrows: boolean
  fieldLines: boolean
  forceVectors: boolean
  velocityVectors: boolean
  trails: boolean
  mouseProbe: boolean
}

export type CanvasDimensions = {
  width: number
  height: number
}

export type SimulationDiagnostics = {
  speedLimited: boolean
  accelerationLimited: boolean
  boundaryHits: number
}

export type FieldReadout = {
  field: Vector2
  fieldMagnitude: number
  potential: number
  force: Vector2
  forceMagnitude: number
}

export type ChargeMetrics = FieldReadout & {
  acceleration: Vector2
  accelerationMagnitude: number
}
