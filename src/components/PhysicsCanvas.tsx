import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { formatMicroC, formatScientific, formatVector } from '../format'
import { renderCanvas } from '../canvasRenderer'
import type {
  CanvasDimensions,
  Charge,
  FieldReadout,
  LayerSettings,
  SimulationSettings,
  Vector2,
} from '../types'

type HoverData = FieldReadout & {
  point: Vector2
  physicalPoint: Vector2
  hoveredCharge: Charge | null
}

type PhysicsCanvasProps = {
  dimensions: CanvasDimensions
  charges: Charge[]
  settings: SimulationSettings
  layers: LayerSettings
  selectedChargeId: string | null
  hoveredChargeId: string | null
  hoverData: HoverData | null
  heatmapLabel: string
  onPointerDown: (point: Vector2) => void
  onPointerMove: (point: Vector2) => void
  onPointerUp: () => void
  onPointerLeave: () => void
}

export function PhysicsCanvas({
  dimensions,
  charges,
  settings,
  layers,
  selectedChargeId,
  hoveredChargeId,
  hoverData,
  heatmapLabel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}: PhysicsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderCanvas(ctx, dimensions, charges, settings, layers, {
      selectedChargeId,
      hoveredChargeId,
    })
  }, [
    charges,
    dimensions,
    hoveredChargeId,
    layers,
    selectedChargeId,
    settings,
  ])

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>): Vector2 {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * dimensions.width,
      y: ((event.clientY - rect.top) / rect.height) * dimensions.height,
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    onPointerDown(pointFromEvent(event))
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    onPointerMove(pointFromEvent(event))
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onPointerUp()
  }

  const tooltipStyle = hoverData
    ? {
        left: Math.min(hoverData.point.x + 18, dimensions.width - 285),
        top: Math.min(hoverData.point.y + 18, dimensions.height - 210),
      }
    : undefined

  return (
    <section className="canvas-panel" aria-label="二维电场画布">
      <div
        className="canvas-stage"
        style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
      >
        <canvas
          ref={canvasRef}
          className="field-canvas"
          style={{ width: '100%', height: '100%' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={onPointerLeave}
        />

        {layers.heatmap ? (
          <div className="color-legend" aria-label="电场强度色标">
            <div className="legend-row">
              <span>低 |E|</span>
              <span>高 |E|</span>
            </div>
            <div className="legend-bar" />
            <div className="legend-unit">{heatmapLabel}</div>
          </div>
        ) : null}

        {layers.mouseProbe && hoverData ? (
          <div className="hover-readout" style={tooltipStyle}>
            <strong>
              ({hoverData.point.x.toFixed(0)} px, {hoverData.point.y.toFixed(0)} px)
            </strong>
            <span>
              物理坐标 ({hoverData.physicalPoint.x.toFixed(3)} m,{' '}
              {hoverData.physicalPoint.y.toFixed(3)} m)
            </span>
            <span>E = {formatVector(hoverData.field, 'N/C')}</span>
            <span>|E| = {formatScientific(hoverData.fieldMagnitude)} N/C</span>
            <span>V = {formatScientific(hoverData.potential)} V</span>
            <span>
              F(q_probe) = {formatVector(hoverData.force, 'N')}
            </span>
            {hoverData.hoveredCharge ? (
              <span className="hover-charge">
                电荷 {formatMicroC(hoverData.hoveredCharge.qMicroC)} ·{' '}
                {hoverData.hoveredCharge.fixed ? '固定' : '可运动'} ·{' '}
                {hoverData.hoveredCharge.isTest ? '测试' : '非测试'}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
