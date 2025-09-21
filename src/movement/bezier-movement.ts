import { bezierCurve, bezierCurveSpeed, direction, extrapolate, magnitude } from '../math'
import type { TimedVector, Vector } from '../math'
import type { MovementAlgorithm, MovementContext, MovementMetrics, MovementOptions, MovementTrace } from './types'

const DEFAULT_WIDTH = 100
const MIN_STEPS = 25

/**
 * Estimates the index of difficulty using a simplified Fitts' Law formula.
 * The result is used to scale the number of points generated for the movement.
 */
const fitts = (distance: number, width: number): number => {
  const a = 0
  const b = 2
  const id = Math.log2(distance / width + 1)
  return a + b * id
}

/**
 * Clamps all vectors to positive coordinates and optionally enriches them
 * with timestamps if the caller requested temporal information.
 */
const clampPositive = (
  vectors: Vector[],
  options: MovementOptions
): Array<Vector | TimedVector> => {
  const clampedVectors = vectors.map((vector) => ({
    x: Math.max(0, vector.x),
    y: Math.max(0, vector.y)
  }))

  return options.useTimestamps === true
    ? generateTimestamps(clampedVectors, options)
    : clampedVectors
}

/**
 * Adds monotonically increasing timestamps to a set of vectors. The cadence is
 * derived from the distance traveled along the Bezier curve and an optional
 * move speed override.
 */
const generateTimestamps = (
  vectors: Vector[],
  options: MovementOptions
): TimedVector[] => {
  const speed = options.moveSpeed ?? (Math.random() * 0.5 + 0.5)

  /**
   * Approximates the travel time between four consecutive control points by
   * sampling the Bezier curve and integrating the instantaneous speeds.
   */
  const timeToMove = (P0: Vector, P1: Vector, P2: Vector, P3: Vector, samples: number): number => {
    let total = 0
    const dt = 1 / samples

    for (let t = 0; t < 1; t += dt) {
      const v1 = bezierCurveSpeed(t * dt, P0, P1, P2, P3)
      const v2 = bezierCurveSpeed(t, P0, P1, P2, P3)
      total += (v1 + v2) * dt / 2
    }

    return Math.round(total / speed)
  }

  const timedVectors: TimedVector[] = []

  for (let i = 0; i < vectors.length; i++) {
    if (i === 0) {
      timedVectors.push({ ...vectors[i], timestamp: Date.now() })
    } else {
      const P0 = vectors[i - 1]
      const P1 = vectors[i]
      const P2 = i + 1 < vectors.length ? vectors[i + 1] : extrapolate(P0, P1)
      const P3 = i + 2 < vectors.length ? vectors[i + 2] : extrapolate(P1, P2)
      const time = timeToMove(P0, P1, P2, P3, vectors.length)

      timedVectors.push({
        ...vectors[i],
        timestamp: timedVectors[i - 1].timestamp + time
      })
    }
  }

  return timedVectors
}

/**
 * Computes the total duration in milliseconds for a trace when timestamps are
 * present. When timestamps are absent the duration is undefined (null).
 */
const computeDuration = (vectors: Array<Vector | TimedVector>): number | null => {
  if (vectors.length === 0) return null
  const first = vectors[0]

  if (!('timestamp' in first)) return null

  const last = vectors[vectors.length - 1] as TimedVector
  return last.timestamp - first.timestamp
}

/**
 * Normalizes an arbitrary point-like object into a `Vector` shape.
 */
const toVector = (point: Vector | { x: number, y: number }): Vector => ({ x: point.x, y: point.y })

/**
 * Summarizes the generated trace with metrics such as step count, distance and
 * optional duration to help callers validate the resulting movement profile.
 */
const buildMetrics = (
  start: Vector,
  finish: Vector,
  width: number,
  vectors: Array<Vector | TimedVector>
): MovementMetrics => ({
  steps: vectors.length,
  distance: magnitude(direction(start, finish)),
  width,
  duration: computeDuration(vectors)
})

/**
 * Default movement algorithm that generates human-like paths using Bezier
 * curves. The algorithm adapts the number of generated steps based on Fitts'
 * Law and clamps vectors so they remain within the visible viewport.
 */
export class BezierMovementAlgorithm implements MovementAlgorithm {
  public readonly name = 'bezier-default'

  /**
   * Generates a Bezier-based movement trace for the requested context.
   */
  public generate ({ start, end, options }: MovementContext): MovementTrace<Vector | TimedVector> {
    const finish = toVector(end)
    const width = 'width' in end && end.width !== 0 ? end.width : DEFAULT_WIDTH
    const curve = bezierCurve(start, finish, options.spreadOverride)
    const length = curve.length() * 0.8

    const speed = options.moveSpeed !== undefined && options.moveSpeed > 0
      ? (25 / options.moveSpeed)
      : Math.random()
    const baseTime = speed * MIN_STEPS
    const steps = Math.ceil((Math.log2(fitts(length, width) + 1) + baseTime) * 3)
    const vectors = clampPositive(curve.getLUT(steps) as Vector[], options)

    return {
      algorithm: this.name,
      vectors,
      metrics: buildMetrics(start, finish, width, vectors)
    }
  }
}
