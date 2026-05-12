import type { Vector2 } from './types'

export function formatMicroC(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)} μC`
}

export function formatGram(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)} g`
}

export function formatSeconds(value: number): string {
  return `${value.toFixed(4)} s`
}

export function formatScientific(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (Math.abs(value) < 1e-3) {
    return value.toExponential(digits)
  }

  if (Math.abs(value) < 1000) {
    return value.toFixed(2)
  }

  return value.toExponential(digits)
}

export function formatVector(vector: Vector2, unit: string): string {
  return `(${formatScientific(vector.x)}, ${formatScientific(vector.y)}) ${unit}`
}

export function formatMeters(value: number): string {
  if (value < 1) {
    return `${(value * 100).toFixed(1)} cm`
  }

  return `${value.toFixed(2)} m`
}
