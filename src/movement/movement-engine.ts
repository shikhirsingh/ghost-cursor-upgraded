import type { MovementAlgorithm, MovementContext, MovementOptions, MovementTrace } from './types'
import type { TimedVector, Vector } from '../math'
import type { BoundingBox } from 'puppeteer'

/**
 * Normalizes optional movement options so algorithms always receive a complete
 * object and can rely on a deterministic `useTimestamps` flag.
 */
const normalizeOptions = (options?: MovementOptions): MovementOptions => ({
  spreadOverride: options?.spreadOverride,
  moveSpeed: options?.moveSpeed,
  useTimestamps: options?.useTimestamps ?? false
})

/**
 * Small façade that accepts raw start/end inputs and defers to a pluggable
 * algorithm to produce a movement trace. The engine ensures a consistent
 * context object is passed to the algorithm.
 */
export class MovementEngine {
  /**
   * Builds a new engine for the given movement algorithm.
   * @param algorithm concrete strategy responsible for generating traces
   */
  public constructor (public readonly algorithm: MovementAlgorithm) {}

  /**
   * Generates a movement trace from the currently configured algorithm.
   * @param start current cursor location
   * @param end destination coordinates or element bounding box
   * @param options optional overrides that tweak how the path is generated
   */
  public generate<T extends Vector | TimedVector = Vector | TimedVector>(
    start: Vector,
    end: Vector | BoundingBox,
    options?: MovementOptions
  ): MovementTrace<T> {
    const context: MovementContext = {
      start,
      end,
      options: normalizeOptions(options)
    }

    return this.algorithm.generate(context) as MovementTrace<T>
  }
}
