import type { TimedVector, Vector } from '../math'
import { MovementEngine, BezierMovementAlgorithm, type MovementAlgorithm } from '../spoof'
import { direction, magnitude } from '../math'

type RandomSpy = jest.SpyInstance<number, []>

/**
 * Replaces `Math.random` with a deterministic generator so the Bezier
 * algorithm produces predictable paths for assertions.
 */
const mockMathRandomSequence = (values: number[]): RandomSpy => {
  let index = 0
  return jest.spyOn(Math, 'random').mockImplementation(() => {
    if (index >= values.length) {
      throw new Error(`Math.random called more times than expected (provided ${values.length} values).`)
    }
    const value = values[index]
    index += 1
    return value
  })
}

/** Converts any vector-like input into a canonical `Vector` instance. */
const toVector = (point: Vector | { x: number, y: number }): Vector => ({ x: point.x, y: point.y })

describe('MovementEngine (BezierMovementAlgorithm)', () => {
  const start: Vector = { x: 12, y: 24 }
  const end: Vector = { x: 160, y: 96 }
  let engine: MovementEngine

  beforeEach(() => {
    engine = new MovementEngine(new BezierMovementAlgorithm())
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('produces deterministic bezier paths with stable metrics when randomness is mocked', () => {
    // Arrange: force the algorithm to use known control points and speeds.
    const randomMock = mockMathRandomSequence([0.1, 0.2, 0.3, 0.4, 0.5])

    // Act: generate a trace with explicit spread and speed overrides.
    const trace = engine.generate(start, end, { moveSpeed: 90, spreadOverride: 30 })

    // Assert: the algorithm metadata and boundary coordinates are preserved.
    expect(trace.algorithm).toBe('bezier-default')
    expect(trace.vectors).toHaveLength(28)
    expect(trace.vectors[0]).toEqual(start)
    expect(trace.vectors[trace.vectors.length - 1]).toEqual(end)
    expect(trace.metrics.steps).toBe(28)
    expect(trace.metrics.distance).toBeCloseTo(magnitude(direction(start, end)))
    expect(trace.metrics.duration).toBeNull()

    // Assert: the first few and final vectors remain unchanged over time.
    expect(trace.vectors.slice(0, 4)).toMatchInlineSnapshot(`
      [
        {
          "x": 12,
          "y": 24,
        },
        {
          "x": 14.860231713077722,
          "y": 26.488774266809983,
        },
        {
          "x": 17.751711439008997,
          "y": 28.959190273054247,
        },
        {
          "x": 20.694885567959737,
          "y": 31.41509309369166,
        },
      ]
    `)

    expect(trace.vectors.slice(-4)).toMatchInlineSnapshot(`
      [
        {
          "x": 130.65350635726003,
          "y": 86.44613420405622,
        },
        {
          "x": 139.90689406461584,
          "y": 89.55555090593734,
        },
        {
          "x": 149.68224314880717,
          "y": 92.73889114626563,
        },
        {
          "x": 160,
          "y": 96,
        },
      ]
    `)

    randomMock.mockRestore()
  })

  it('generates monotonic timestamps and duration metrics when requested', () => {
    // Arrange: deterministically control randomness and the system clock.
    const randomMock = mockMathRandomSequence([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7])

    jest.useFakeTimers()
    jest.setSystemTime(new Date('2023-11-14T22:13:20.000Z'))

    // Act: generate a trace that includes timestamps.
    const trace = engine.generate(start, end, { spreadOverride: 30, useTimestamps: true })
    const vectors = trace.vectors as TimedVector[]

    // Assert: movement metadata describes a timestamped trace.
    expect(vectors).toHaveLength(52)
    expect(vectors[0]).toEqual({ x: 12, y: 24, timestamp: 1700000000000 })
    expect(vectors[vectors.length - 1]).toEqual({ x: 160, y: 96, timestamp: 1700000000592 })
    expect(trace.metrics.duration).toBe(592)

    // Assert: each timestamp should be monotonically increasing.
    for (let i = 1; i < vectors.length; i++) {
      expect(vectors[i].timestamp).toBeGreaterThanOrEqual(vectors[i - 1].timestamp)
    }

    // Assert: snapshot the start and end of the trace for future regression detection.
    expect(vectors.slice(0, 3)).toMatchInlineSnapshot(`
      [
        {
          "timestamp": 1700000000000,
          "x": 12,
          "y": 24,
        },
        {
          "timestamp": 1700000000007,
          "x": 13.511596340097405,
          "y": 25.320108008533815,
        },
        {
          "timestamp": 1700000000014,
          "x": 15.029253997693658,
          "y": 26.63456347618175,
        },
      ]
    `)

    expect(vectors.slice(-3)).toMatchInlineSnapshot(`
      [
        {
          "timestamp": 1700000000552,
          "x": 149.09240762775784,
          "y": 92.54952064000062,
        },
        {
          "timestamp": 1700000000572,
          "x": 154.46884326472477,
          "y": 94.26360837727351,
        },
        {
          "timestamp": 1700000000592,
          "x": 160,
          "y": 96,
        },
      ]
    `)

    randomMock.mockRestore()
  })

  /**
   * Minimal linear algorithm used to demonstrate pluggable strategy support.
   */
  class LinearMovementAlgorithm implements MovementAlgorithm {
    public readonly name = 'linear-test'
    public readonly contexts: Array<{ start: Vector, end: Vector }> = []

    /** Returns a trivial two-vector trace for deterministic assertions. */
    public generate ({ start, end }: Parameters<MovementAlgorithm['generate']>[0]): ReturnType<MovementAlgorithm['generate']> {
      const finish = toVector(end)
      this.contexts.push({ start, end: finish })
      return {
        algorithm: this.name,
        vectors: [start, finish],
        metrics: {
          steps: 2,
          distance: magnitude(direction(start, finish)),
          width: 'width' in end && end.width !== 0 ? end.width : 0,
          duration: null
        }
      }
    }
  }

  it('supports pluggable algorithms for experimentation', () => {
    // Arrange: inject the test algorithm into a new engine instance.
    const algorithm = new LinearMovementAlgorithm()
    const linearEngine = new MovementEngine(algorithm)
    const finish: Vector = { x: 64, y: 144 }

    // Act: generate a simple straight-line trace.
    const trace = linearEngine.generate(start, finish)

    // Assert: the algorithm context and output were forwarded untouched.
    expect(trace.algorithm).toBe('linear-test')
    expect(trace.vectors).toEqual([start, finish])
    expect(trace.metrics.steps).toBe(2)
    expect(algorithm.contexts).toHaveLength(1)
    expect(algorithm.contexts[0]).toEqual({ start, end: finish })
  })

  it('navigates complex multi-target layouts while preserving continuity and adaptive pacing', () => {
    // Arrange: craft a complex navigation scenario using deterministic randomness.
    const randomMock = mockMathRandomSequence([
      0.05, 0.18, 0.22, 0.37, 0.41,
      0.52, 0.63, 0.15, 0.29, 0.44,
      0.58, 0.69, 0.11, 0.24, 0.36
    ])

    // Define high-level navigation waypoints that mimic a dense web application.
    const segments: Array<{
      readonly label: string
      readonly end: Vector & { width: number, height: number }
      readonly options: { moveSpeed: number, spreadOverride: number }
    }> = [
      {
        label: 'global navigation to mega menu entry',
        end: { x: 320, y: 180, width: 220, height: 60 },
        options: { moveSpeed: 95, spreadOverride: 35 }
      },
      {
        label: 'mega menu to nested panel CTA',
        end: { x: 640, y: 420, width: 80, height: 32 },
        options: { moveSpeed: 65, spreadOverride: 18 }
      },
      {
        label: 'panel CTA to floating toolbar action',
        end: { x: 1180, y: 760, width: 40, height: 28 },
        options: { moveSpeed: 45, spreadOverride: 12 }
      }
    ]

    let current = { x: 96, y: 32 }
    const stepCounts: number[] = []
    let totalDistance = 0

    // Act: walk through each segment, ensuring continuity across moves.
    for (const segment of segments) {
      const trace = engine.generate(current, segment.end, segment.options)
      const finish = trace.vectors[trace.vectors.length - 1]

      // Assert: confirm continuity and consistent width metrics for each target.
      expect(trace.vectors[0]).toEqual(current)
      expect(finish.x).toBeCloseTo(segment.end.x, 3)
      expect(finish.y).toBeCloseTo(segment.end.y, 3)
      expect(trace.metrics.steps).toBeGreaterThan(10)
      expect(trace.metrics.width).toBe(segment.end.width)

      stepCounts.push(trace.metrics.steps)
      totalDistance += trace.metrics.distance
      current = toVector(finish)
    }

    // Assert: after the final segment we should be positioned at the final target.
    expect(current.x).toBeCloseTo(segments[segments.length - 1].end.x, 3)
    expect(current.y).toBeCloseTo(segments[segments.length - 1].end.y, 3)

    // Assert: Fitts' Law heuristics should scale step counts with difficulty.
    expect(stepCounts[0]).toBeLessThan(stepCounts[1])
    expect(stepCounts[1]).toBeLessThan(stepCounts[2])
    expect(totalDistance).toBeGreaterThan(segments[segments.length - 1].end.x)

    randomMock.mockRestore()
  })

  it('clamps negative intermediate coordinates to zero to prevent off-screen drift', () => {
    // Arrange: ensure randomness is predictable and the start point begins off-screen.
    const randomMock = mockMathRandomSequence(Array.from({ length: 64 }, () => 0.5))
    const offscreenStart: Vector = { x: -50, y: -25 }
    const nearTarget: Vector = { x: 10, y: 5 }

    // Act: generate a trace moving back into the viewport.
    const trace = engine.generate(offscreenStart, nearTarget, { spreadOverride: 10 })

    // Assert: every vector should be clamped at or above zero on both axes.
    for (const vector of trace.vectors) {
      expect(vector.x).toBeGreaterThanOrEqual(0)
      expect(vector.y).toBeGreaterThanOrEqual(0)
    }
    expect(trace.vectors[0]).toEqual({ x: 0, y: 0 })
    expect(trace.vectors[trace.vectors.length - 1]).toEqual(nearTarget)

    randomMock.mockRestore()
  })

  it('produces a degenerate but valid trace when start and end points coincide', () => {
    // Arrange: create a context with zero distance between start and end.
    const stationaryPoint: Vector = { x: 256, y: 256 }

    // Act: request a trace for a no-op movement.
    const trace = engine.generate(stationaryPoint, stationaryPoint, { moveSpeed: 75 })

    // Assert: the trace should contain at least the starting point and never wander.
    expect(trace.vectors.length).toBeGreaterThanOrEqual(1)
    expect(trace.vectors[0]).toEqual(stationaryPoint)
    expect(trace.vectors[trace.vectors.length - 1]).toEqual(stationaryPoint)
    expect(trace.metrics.distance).toBeCloseTo(0)
    expect(trace.metrics.steps).toBe(trace.vectors.length)
  })
})
