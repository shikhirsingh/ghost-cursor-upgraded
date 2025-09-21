import type { BoundingBox } from 'puppeteer'
import type { TimedVector, Vector } from '../math'

/**
 * Configuration flags that movement algorithms may honor when producing a path.
 * Each option is optional so callers can request fine-grained overrides while
 * still allowing algorithms to fall back to their default heuristics.
 */
export interface MovementOptions {
  /** How aggressively the generated path may deviate from a straight line. */
  readonly spreadOverride?: number
  /** Higher values cause algorithms to complete the movement faster. */
  readonly moveSpeed?: number
  /** When true algorithms should attach timestamps to the returned vectors. */
  readonly useTimestamps?: boolean
}

/**
 * The immutable context supplied to a movement algorithm describing the
 * starting point, the requested end position (or element box) and the
 * caller-specified options for how the move should be generated.
 */
export interface MovementContext {
  /** Current location of the cursor when the algorithm is invoked. */
  readonly start: Vector
  /** Destination vector or bounding box to navigate towards. */
  readonly end: Vector | BoundingBox
  /** Per-call option overrides applied during path generation. */
  readonly options: MovementOptions
}

/**
 * Metrics describing the generated path so tests and telemetry can reason
 * about the movement profile without re-inspecting the raw vectors.
 */
export interface MovementMetrics {
  /** Total number of intermediate vectors in the trace. */
  readonly steps: number
  /** Euclidean distance between the starting and ending points. */
  readonly distance: number
  /** Effective width of the destination target used for Fitts' Law scaling. */
  readonly width: number
  /** Duration in milliseconds when timestamps are present, otherwise null. */
  readonly duration: number | null
}

/**
 * A full description of an algorithm's output containing the generated
 * vectors and the computed metrics along with an algorithm identifier.
 */
export interface MovementTrace<T extends Vector = Vector> {
  /** Human-readable identifier for the algorithm that produced the trace. */
  readonly algorithm: string
  /** Ordered list of cursor coordinates that form the movement path. */
  readonly vectors: T[]
  /** Summary information describing the produced path. */
  readonly metrics: MovementMetrics
}

/**
 * Contract implemented by every pluggable movement algorithm. Algorithms must
 * expose a name for diagnostics and provide a `generate` method that returns
 * a movement trace given a context.
 */
export interface MovementAlgorithm {
  /** Unique identifier for the algorithm implementation. */
  readonly name: string
  /** Produce a trace describing how to move from the start to the end point. */
  generate: (context: MovementContext) => MovementTrace<Vector | TimedVector>
}
