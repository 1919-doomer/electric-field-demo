import {
  computeElectricFieldAtPoint,
  computeForceOnCharge,
  contributesToField,
  magnitude,
  normalize,
  scale,
  subtract,
} from './physics'
import type {
  CanvasDimensions,
  Charge,
  LayerSettings,
  SimulationSettings,
  Vector2,
} from './types'

type RenderOptions = {
  selectedChargeId: string | null
  hoveredChargeId: string | null
}

const COLOR_STOPS = [
  { t: 0, color: [37, 99, 235] },
  { t: 0.32, color: [8, 145, 178] },
  { t: 0.58, color: [234, 179, 8] },
  { t: 0.78, color: [249, 115, 22] },
  { t: 1, color: [220, 38, 38] },
]

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
  charges: Charge[],
  settings: SimulationSettings,
  layers: LayerSettings,
  options: RenderOptions,
) {
  ctx.clearRect(0, 0, dimensions.width, dimensions.height)
  drawBackground(ctx, dimensions)

  if (layers.heatmap) {
    drawHeatmap(ctx, dimensions, charges, settings)
  }

  if (layers.fieldLines) {
    drawFieldLines(ctx, dimensions, charges, settings)
  }

  if (layers.fieldArrows) {
    drawFieldArrows(ctx, dimensions, charges, settings)
  }

  if (layers.trails) {
    drawTrails(ctx, charges)
  }

  if (layers.forceVectors) {
    drawForceVectors(ctx, charges, settings)
  }

  if (layers.velocityVectors) {
    drawVelocityVectors(ctx, charges, settings)
  }

  drawCharges(ctx, charges, settings, options)
}

function drawBackground(ctx: CanvasRenderingContext2D, dimensions: CanvasDimensions) {
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, dimensions.width, dimensions.height)

  ctx.save()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1

  for (let x = 0; x <= dimensions.width; x += 50) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, dimensions.height)
    ctx.stroke()
  }

  for (let y = 0; y <= dimensions.height; y += 50) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(dimensions.width, y)
    ctx.stroke()
  }

  ctx.strokeStyle = '#cbd5e1'
  ctx.beginPath()
  ctx.moveTo(dimensions.width / 2, 0)
  ctx.lineTo(dimensions.width / 2, dimensions.height)
  ctx.moveTo(0, dimensions.height / 2)
  ctx.lineTo(dimensions.width, dimensions.height / 2)
  ctx.stroke()
  ctx.restore()
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
  charges: Charge[],
  settings: SimulationSettings,
) {
  const cell = settings.heatmapCellPx
  const samples: { x: number; y: number; logStrength: number }[] = []
  let maxLog = settings.heatmapAutoRange ? 1 : settings.heatmapMaxLog

  for (let y = cell / 2; y < dimensions.height; y += cell) {
    for (let x = cell / 2; x < dimensions.width; x += cell) {
      const field = computeElectricFieldAtPoint({ x, y }, charges, settings)
      const logStrength = Math.log10(1 + magnitude(field))
      maxLog = Math.max(maxLog, logStrength)
      samples.push({ x, y, logStrength })
    }
  }

  const normalizedMax = settings.heatmapAutoRange
    ? Math.min(Math.max(maxLog, 2), 7)
    : settings.heatmapMaxLog

  ctx.save()
  ctx.globalAlpha = 0.48
  for (const sample of samples) {
    const t = Math.min(sample.logStrength / normalizedMax, 1)
    ctx.fillStyle = heatColor(t)
    ctx.fillRect(sample.x - cell / 2, sample.y - cell / 2, cell + 1, cell + 1)
  }
  ctx.restore()
}

function drawFieldArrows(
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
  charges: Charge[],
  settings: SimulationSettings,
) {
  const grid = settings.vectorGridPx

  ctx.save()
  ctx.strokeStyle = '#0f172a'
  ctx.fillStyle = '#0f172a'
  ctx.globalAlpha = 0.74

  for (let y = grid / 2; y < dimensions.height; y += grid) {
    for (let x = grid / 2; x < dimensions.width; x += grid) {
      const field = computeElectricFieldAtPoint({ x, y }, charges, settings)
      const strength = magnitude(field)
      if (strength < 1e-6) {
        continue
      }

      const direction = normalize(field)
      const length = 8 + Math.min(20, Math.log10(1 + strength) * 3.2)
      drawArrow(ctx, { x, y }, scale(direction, length), 7)
    }
  }

  ctx.restore()
}

function drawFieldLines(
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
  charges: Charge[],
  settings: SimulationSettings,
) {
  ctx.save()
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.56)'
  ctx.lineWidth = 1.25

  const positiveSources = charges.filter(
    (charge) => contributesToField(charge, settings) && charge.qMicroC > 0,
  )
  const negativeSources = charges.filter(
    (charge) => contributesToField(charge, settings) && charge.qMicroC < 0,
  )

  for (const charge of positiveSources) {
    const count = Math.min(28, Math.max(6, Math.round(Math.abs(charge.qMicroC) * 3)))
    const startRadius = settings.chargeRadiusPx + 5

    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count
      let point = {
        x: charge.position.x + Math.cos(angle) * startRadius,
        y: charge.position.y + Math.sin(angle) * startRadius,
      }

      ctx.beginPath()
      ctx.moveTo(point.x, point.y)

      for (let step = 0; step < settings.fieldLineMaxSteps; step += 1) {
        if (
          point.x < 0 ||
          point.x > dimensions.width ||
          point.y < 0 ||
          point.y > dimensions.height ||
          isNearNegativeSource(point, negativeSources, settings.rMinPx * 1.4)
        ) {
          break
        }

        const field = computeElectricFieldAtPoint(point, charges, settings)
        const direction = normalize(field)
        if (magnitude(direction) < 1e-6) {
          break
        }

        point = {
          x: point.x + direction.x * settings.fieldLineStepPx,
          y: point.y + direction.y * settings.fieldLineStepPx,
        }
        ctx.lineTo(point.x, point.y)
      }

      ctx.stroke()
    }
  }

  ctx.restore()
}

function drawTrails(ctx: CanvasRenderingContext2D, charges: Charge[]) {
  ctx.save()
  ctx.lineWidth = 1.8

  for (const charge of charges) {
    if (charge.trail.length < 2) {
      continue
    }

    ctx.strokeStyle =
      charge.qMicroC >= 0 ? 'rgba(185, 28, 28, 0.45)' : 'rgba(29, 78, 216, 0.45)'
    ctx.beginPath()
    ctx.moveTo(charge.trail[0].x, charge.trail[0].y)

    for (const point of charge.trail.slice(1)) {
      ctx.lineTo(point.x, point.y)
    }

    ctx.stroke()
  }

  ctx.restore()
}

function drawForceVectors(
  ctx: CanvasRenderingContext2D,
  charges: Charge[],
  settings: SimulationSettings,
) {
  ctx.save()
  ctx.strokeStyle = '#7c2d12'
  ctx.fillStyle = '#7c2d12'
  ctx.lineWidth = 2.2

  for (const charge of charges) {
    if (!charge.isTest) {
      continue
    }

    const force = computeForceOnCharge(charge, charges, settings)
    const forceMagnitude = magnitude(force)
    if (forceMagnitude < 1e-9) {
      continue
    }

    const direction = normalize(force)
    const length = Math.min(58, 10 + Math.log10(1 + forceMagnitude * 1e6) * 10)
    drawArrow(ctx, charge.position, scale(direction, length), 9)
  }

  ctx.restore()
}

function drawVelocityVectors(
  ctx: CanvasRenderingContext2D,
  charges: Charge[],
  settings: SimulationSettings,
) {
  ctx.save()
  ctx.strokeStyle = '#047857'
  ctx.fillStyle = '#047857'
  ctx.lineWidth = 2

  for (const charge of charges) {
    if (charge.fixed || magnitude(charge.velocity) < 2) {
      continue
    }

    const length = Math.min(52, magnitude(charge.velocity) * 0.12)
    drawArrow(ctx, charge.position, scale(normalize(charge.velocity), length), 8)
  }

  ctx.restore()
  void settings
}

function drawCharges(
  ctx: CanvasRenderingContext2D,
  charges: Charge[],
  settings: SimulationSettings,
  options: RenderOptions,
) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const charge of charges) {
    const radius = settings.chargeRadiusPx
    const selected = charge.id === options.selectedChargeId
    const hovered = charge.id === options.hoveredChargeId
    const fill = charge.qMicroC >= 0 ? '#dc2626' : '#2563eb'
    const stroke = selected ? '#111827' : hovered ? '#f59e0b' : '#ffffff'

    ctx.beginPath()
    ctx.arc(charge.position.x, charge.position.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = selected ? 4 : hovered ? 3 : 2
    ctx.strokeStyle = stroke
    ctx.stroke()

    if (!charge.fixed) {
      ctx.beginPath()
      ctx.arc(charge.position.x, charge.position.y, radius + 5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(15, 118, 110, 0.55)'
      ctx.setLineDash([5, 4])
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      drawLockGlyph(ctx, charge.position.x + radius - 2, charge.position.y - radius + 2)
    }

    ctx.font = '700 17px system-ui, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(charge.qMicroC >= 0 ? '+' : '−', charge.position.x, charge.position.y)

    ctx.font = '12px system-ui, sans-serif'
    ctx.fillStyle = '#0f172a'
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)'
    ctx.lineWidth = 4
    const label = `${charge.qMicroC >= 0 ? '+' : ''}${charge.qMicroC.toFixed(1)} μC`
    const labelY = charge.position.y + radius + 15
    ctx.strokeText(label, charge.position.x, labelY)
    ctx.fillText(label, charge.position.x, labelY)

    if (charge.isTest) {
      ctx.font = '11px system-ui, sans-serif'
      ctx.fillStyle = '#334155'
      ctx.fillText('test', charge.position.x, labelY + 14)
    }
  }

  ctx.restore()
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  origin: Vector2,
  vector: Vector2,
  headSize: number,
) {
  const end = { x: origin.x + vector.x, y: origin.y + vector.y }
  const angle = Math.atan2(vector.y, vector.x)

  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(
    end.x - Math.cos(angle - Math.PI / 6) * headSize,
    end.y - Math.sin(angle - Math.PI / 6) * headSize,
  )
  ctx.lineTo(
    end.x - Math.cos(angle + Math.PI / 6) * headSize,
    end.y - Math.sin(angle + Math.PI / 6) * headSize,
  )
  ctx.closePath()
  ctx.fill()
}

function drawLockGlyph(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.strokeStyle = '#111827'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.roundRect(x - 5, y - 1, 10, 8, 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y - 1, 4, Math.PI, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function heatColor(t: number): string {
  const clamped = Math.min(Math.max(t, 0), 1)
  const nextIndex = COLOR_STOPS.findIndex((stop) => stop.t >= clamped)
  const upper = COLOR_STOPS[Math.max(nextIndex, 1)]
  const lower = COLOR_STOPS[Math.max(nextIndex - 1, 0)]
  const localT = (clamped - lower.t) / Math.max(upper.t - lower.t, 1e-6)
  const color = lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * localT),
  )

  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
}

function isNearNegativeSource(
  point: Vector2,
  negativeSources: Charge[],
  thresholdPx: number,
): boolean {
  return negativeSources.some(
    (charge) => magnitude(subtract(point, charge.position)) < thresholdPx,
  )
}
