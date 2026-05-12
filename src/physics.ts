import type {
  CanvasDimensions,
  Charge,
  ChargeMetrics,
  FieldReadout,
  SimulationDiagnostics,
  SimulationSettings,
  Vector2,
} from './types'

const EPSILON = 1e-9

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(v: Vector2, factor: number): Vector2 {
  return { x: v.x * factor, y: v.y * factor }
}

export function magnitude(v: Vector2): number {
  return Math.hypot(v.x, v.y)
}

export function normalize(v: Vector2): Vector2 {
  const length = magnitude(v)
  if (length < EPSILON) {
    return { x: 0, y: 0 }
  }

  return { x: v.x / length, y: v.y / length }
}

export function clampMagnitude(v: Vector2, maxMagnitude: number): Vector2 {
  const length = magnitude(v)
  if (length <= maxMagnitude || length < EPSILON) {
    return v
  }

  return scale(v, maxMagnitude / length)
}

export function microCoulombsToCoulombs(value: number): number {
  return value * 1e-6
}

export function gramsToKilograms(value: number): number {
  return Math.max(value * 1e-3, 1e-9)
}

export function contributesToField(
  charge: Charge,
  settings: SimulationSettings,
): boolean {
  if (!charge.isSource || Math.abs(charge.qMicroC) < EPSILON) {
    return false
  }

  return !charge.isTest || settings.testChargesAffectField
}

export function computeElectricFieldAtPoint(
  pointPx: Vector2,
  charges: Charge[],
  settings: SimulationSettings,
  excludeChargeId?: string,
): Vector2 {
  return charges.reduce<Vector2>((field, charge) => {
    if (charge.id === excludeChargeId || !contributesToField(charge, settings)) {
      return field
    }

    const deltaPx = subtract(pointPx, charge.position)
    const rawDistancePx = magnitude(deltaPx)
    const direction =
      rawDistancePx < EPSILON ? { x: 1, y: 0 } : scale(deltaPx, 1 / rawDistancePx)
    const limitedDistancePx = Math.max(rawDistancePx, settings.rMinPx)
    const distanceM = limitedDistancePx * settings.metersPerPixel
    const sourceQ = microCoulombsToCoulombs(charge.qMicroC)

    // E = k q r_hat / r^2. The distance is clamped by r_min to avoid the
    // point-charge singularity from producing Infinity or NaN in the renderer.
    const contribution = scale(
      direction,
      (settings.simulationK * sourceQ) / (distanceM * distanceM),
    )

    return add(field, contribution)
  }, { x: 0, y: 0 })
}

export function computePotentialAtPoint(
  pointPx: Vector2,
  charges: Charge[],
  settings: SimulationSettings,
  excludeChargeId?: string,
): number {
  return charges.reduce((potential, charge) => {
    if (charge.id === excludeChargeId || !contributesToField(charge, settings)) {
      return potential
    }

    const rawDistancePx = magnitude(subtract(pointPx, charge.position))
    const limitedDistancePx = Math.max(rawDistancePx, settings.rMinPx)
    const distanceM = limitedDistancePx * settings.metersPerPixel
    const sourceQ = microCoulombsToCoulombs(charge.qMicroC)

    return potential + (settings.simulationK * sourceQ) / distanceM
  }, 0)
}

export function computeForceOnCharge(
  charge: Charge,
  charges: Charge[],
  settings: SimulationSettings,
): Vector2 {
  const field = computeElectricFieldAtPoint(
    charge.position,
    charges,
    settings,
    charge.id,
  )

  return scale(field, microCoulombsToCoulombs(charge.qMicroC))
}

export function computeReadoutForProbe(
  pointPx: Vector2,
  probeChargeMicroC: number,
  charges: Charge[],
  settings: SimulationSettings,
): FieldReadout {
  const field = computeElectricFieldAtPoint(pointPx, charges, settings)
  const force = scale(field, microCoulombsToCoulombs(probeChargeMicroC))
  const potential = computePotentialAtPoint(pointPx, charges, settings)

  return {
    field,
    fieldMagnitude: magnitude(field),
    potential,
    force,
    forceMagnitude: magnitude(force),
  }
}

export function computeChargeMetrics(
  charge: Charge,
  charges: Charge[],
  settings: SimulationSettings,
): ChargeMetrics {
  const field = computeElectricFieldAtPoint(
    charge.position,
    charges,
    settings,
    charge.id,
  )
  const force = scale(field, microCoulombsToCoulombs(charge.qMicroC))
  const massKg = gramsToKilograms(charge.massGram)
  const acceleration = scale(force, 1 / massKg)

  return {
    field,
    fieldMagnitude: magnitude(field),
    potential: computePotentialAtPoint(
      charge.position,
      charges,
      settings,
      charge.id,
    ),
    force,
    forceMagnitude: magnitude(force),
    acceleration,
    accelerationMagnitude: magnitude(acceleration),
  }
}

export function updateSimulationStep(
  charges: Charge[],
  settings: SimulationSettings,
  dimensions: CanvasDimensions,
): { charges: Charge[]; diagnostics: SimulationDiagnostics } {
  const diagnostics: SimulationDiagnostics = {
    speedLimited: false,
    accelerationLimited: false,
    boundaryHits: 0,
  }

  const updatedCharges = charges.map((charge) => {
    if (charge.fixed || charge.stopped) {
      return {
        ...charge,
        velocity: charge.fixed ? { x: 0, y: 0 } : charge.velocity,
      }
    }

    const force = computeForceOnCharge(charge, charges, settings)
    const massKg = gramsToKilograms(charge.massGram)
    const accelerationMeters = scale(force, 1 / massKg)
    let accelerationPx = scale(accelerationMeters, 1 / settings.metersPerPixel)

    // This cap is a numerical stability guard for classroom visualization.
    // It is not part of Coulomb's law or Newton's second law.
    if (
      settings.enableAccelerationLimit &&
      magnitude(accelerationPx) > settings.accelerationLimitPxPerS2
    ) {
      accelerationPx = clampMagnitude(
        accelerationPx,
        settings.accelerationLimitPxPerS2,
      )
      diagnostics.accelerationLimited = true
    }

    let velocity = add(charge.velocity, scale(accelerationPx, settings.dt))

    if (
      settings.enableSpeedLimit &&
      magnitude(velocity) > settings.speedLimitPxPerS
    ) {
      velocity = clampMagnitude(velocity, settings.speedLimitPxPerS)
      diagnostics.speedLimited = true
    }

    let position = add(charge.position, scale(velocity, settings.dt))
    let stopped = false

    const radius = settings.chargeRadiusPx
    const minX = radius
    const maxX = dimensions.width - radius
    const minY = radius
    const maxY = dimensions.height - radius

    if (settings.boundaryMode === 'bounce') {
      if (position.x < minX || position.x > maxX) {
        position = {
          ...position,
          x: Math.min(Math.max(position.x, minX), maxX),
        }
        velocity = { ...velocity, x: position.x <= minX ? Math.abs(velocity.x) : -Math.abs(velocity.x) }
        diagnostics.boundaryHits += 1
      }
      if (position.y < minY || position.y > maxY) {
        position = {
          ...position,
          y: Math.min(Math.max(position.y, minY), maxY),
        }
        velocity = { ...velocity, y: position.y <= minY ? Math.abs(velocity.y) : -Math.abs(velocity.y) }
        diagnostics.boundaryHits += 1
      }
    } else if (settings.boundaryMode === 'stop') {
      if (
        position.x < minX ||
        position.x > maxX ||
        position.y < minY ||
        position.y > maxY
      ) {
        position = {
          x: Math.min(Math.max(position.x, minX), maxX),
          y: Math.min(Math.max(position.y, minY), maxY),
        }
        velocity = { x: 0, y: 0 }
        stopped = true
        diagnostics.boundaryHits += 1
      }
    } else {
      if (position.x < 0) {
        position = { ...position, x: dimensions.width }
        diagnostics.boundaryHits += 1
      } else if (position.x > dimensions.width) {
        position = { ...position, x: 0 }
        diagnostics.boundaryHits += 1
      }

      if (position.y < 0) {
        position = { ...position, y: dimensions.height }
        diagnostics.boundaryHits += 1
      } else if (position.y > dimensions.height) {
        position = { ...position, y: 0 }
        diagnostics.boundaryHits += 1
      }
    }

    const trail = [...charge.trail, position].slice(-settings.trailLimit)

    return {
      ...charge,
      position,
      velocity,
      stopped,
      trail,
    }
  })

  return { charges: updatedCharges, diagnostics }
}
