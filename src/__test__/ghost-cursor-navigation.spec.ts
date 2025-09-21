import type { MovementAlgorithm, MovementMetrics, MovementTrace } from '../spoof'
import { GhostCursor } from '../spoof'
import type { TimedVector, Vector } from '../math'
import { direction, magnitude } from '../math'
import type { BoundingBox, Page } from 'puppeteer'

interface MockCdpClient {
  send: jest.Mock<Promise<void>, [string, unknown]>
}

interface ScriptedSegment {
  readonly vectors: Array<Vector | TimedVector>
  readonly width?: number
}

/** Converts any vector-like structure into a canonical `Vector`. */
const toVector = (point: Vector | { x: number, y: number }): Vector => ({ x: point.x, y: point.y })

/** Builds a mock CDP client that records each dispatched mouse event. */
const mockClient = (): MockCdpClient => ({
  send: jest.fn().mockResolvedValue(undefined)
})

/** Creates a minimal `Page` mock compatible with the GhostCursor constructor. */
const mockPage = (client: MockCdpClient = mockClient()): Page => ({
  _client: () => client,
  browser: () => ({
    isConnected: () => true
  })
}) as unknown as Page

/**
 * Lightweight movement algorithm that replays a scripted set of vectors. It is
 * used to validate GhostCursor behaviour without depending on Bezier math.
 */
class ScriptedAlgorithm implements MovementAlgorithm {
  public readonly name = 'scripted-movement'
  private readonly segments: ScriptedSegment[]
  public readonly contexts: Array<Parameters<MovementAlgorithm['generate']>[0]> = []

  /** Queues the scripted segments that will be replayed by the mock algorithm. */
  public constructor (segments: ScriptedSegment[]) {
    this.segments = [...segments]
  }

  /**
   * Returns the next scripted segment while capturing the invocation context so
   * tests can verify continuity between cursor moves.
   */
  public generate (context: Parameters<MovementAlgorithm['generate']>[0]): MovementTrace<Vector | TimedVector> {
    const next = this.segments.shift()
    if (next === undefined) {
      throw new Error('No scripted movement segment available for test invocation')
    }

    this.contexts.push(context)
    const finish = next.vectors[next.vectors.length - 1]
    const firstVector = next.vectors[0]
    const metrics: MovementMetrics = {
      steps: next.vectors.length,
      distance: magnitude(direction(context.start, toVector(context.end))),
      width: 'width' in context.end && context.end.width !== 0 ? context.end.width : next.width ?? 0,
      duration: 'timestamp' in firstVector && 'timestamp' in finish
        ? (finish).timestamp - (firstVector).timestamp
        : null
    }

    return {
      algorithm: this.name,
      vectors: next.vectors,
      metrics
    }
  }
}

describe('GhostCursor complex navigation sequences', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('streams scripted movement traces through multiple regions of a complex page', async () => {
    // Arrange: build a three-segment script mirroring a demanding user journey.
    const segments: ScriptedSegment[] = [
      {
        vectors: [
          { x: 48, y: 48, timestamp: 10 },
          { x: 180, y: 72, timestamp: 18 },
          { x: 300, y: 110, timestamp: 32 }
        ],
        width: 280
      },
      {
        vectors: [
          { x: 300, y: 110, timestamp: 40 },
          { x: 402, y: 156, timestamp: 56 },
          { x: 512, y: 240, timestamp: 80 }
        ],
        width: 140
      },
      {
        vectors: [
          { x: 512, y: 240, timestamp: 90 },
          { x: 640, y: 310, timestamp: 102 },
          { x: 704, y: 420, timestamp: 118 },
          { x: 752, y: 512, timestamp: 135 }
        ],
        width: 96
      }
    ]

    // Arrange: instantiate the cursor with deterministic scripted vectors.
    const algorithm = new ScriptedAlgorithm(segments)
    const client = mockClient()
    const page = mockPage(client)
    const cursor = new GhostCursor(page, {
      start: { x: 48, y: 48 },
      movementAlgorithm: algorithm,
      defaultOptions: {
        moveTo: { useTimestamps: true, moveDelay: 0, randomizeMoveDelay: false }
      }
    })

    // Arrange: identify complex targets reminiscent of a real web application.
    const navTrigger: BoundingBox = { x: 300, y: 110, width: 280, height: 60 }
    const submenuTarget: BoundingBox = { x: 512, y: 240, width: 140, height: 48 }
    const toolbarAction: BoundingBox = { x: 752, y: 512, width: 96, height: 32 }

    // Act: sequentially move through the complex layout.
    await cursor.moveTo(navTrigger)
    await cursor.moveTo(submenuTarget)
    await cursor.moveTo(toolbarAction)

    // Assert: collect all CDP calls emitted during the scripted navigation.
    const sendCalls = client.send.mock.calls
    expect(sendCalls).toHaveLength(10)

    // Extract timestamps and coordinates for human-readable verification.
    const timestamps = sendCalls.map(([_, payload]) => (payload as { timestamp?: number }).timestamp)
    const coords = sendCalls.map(([_, payload]) => ({ x: (payload as { x: number }).x, y: (payload as { y: number }).y }))

    // Assert: verify timestamp propagation and ordering across the full journey.
    expect(timestamps.filter((value): value is number => value !== undefined)).toEqual([
      10, 18, 32,
      40, 56, 80,
      90, 102, 118, 135
    ])

    // Assert: snapshot the entry and exit coordinates to detect regressions.
    expect(coords.slice(0, 3)).toMatchInlineSnapshot(`
      [
        {
          "x": 48,
          "y": 48,
        },
        {
          "x": 180,
          "y": 72,
        },
        {
          "x": 300,
          "y": 110,
        },
      ]
    `)

    expect(coords.slice(-3)).toMatchInlineSnapshot(`
      [
        {
          "x": 640,
          "y": 310,
        },
        {
          "x": 704,
          "y": 420,
        },
        {
          "x": 752,
          "y": 512,
        },
      ]
    `)

    expect(cursor.getLocation()).toEqual({ x: 752, y: 512, timestamp: 135 })

    // Assert: ensure every move started from the previous location.
    expect(algorithm.contexts).toHaveLength(3)
    expect(algorithm.contexts[0].start).toEqual({ x: 48, y: 48 })
    expect(algorithm.contexts[1].start).toEqual({ x: 300, y: 110, timestamp: 32 })
    expect(algorithm.contexts[2].start).toEqual({ x: 512, y: 240, timestamp: 80 })
  })

  it('updates the cursor location correctly when timestamps are omitted', async () => {
    // Arrange: set up a scripted path without timestamps to mimic a light-weight algorithm.
    const segments: ScriptedSegment[] = [
      {
        vectors: [
          { x: 10, y: 10 },
          { x: 20, y: 25 },
          { x: 30, y: 30 }
        ]
      },
      {
        vectors: [
          { x: 30, y: 30 },
          { x: 35, y: 40 },
          { x: 40, y: 50 }
        ]
      }
    ]

    // Arrange: initialise the cursor with deterministic scripted output.
    const algorithm = new ScriptedAlgorithm(segments)
    const client = mockClient()
    const page = mockPage(client)
    const cursor = new GhostCursor(page, {
      start: { x: 10, y: 10 },
      movementAlgorithm: algorithm,
      defaultOptions: {
        moveTo: { useTimestamps: false, moveDelay: 0, randomizeMoveDelay: false }
      }
    })

    const firstTarget: BoundingBox = { x: 30, y: 30, width: 40, height: 20 }
    const secondTarget: BoundingBox = { x: 40, y: 50, width: 50, height: 30 }

    // Act: perform two consecutive moves using the non-timestamped trace.
    await cursor.moveTo(firstTarget)
    await cursor.moveTo(secondTarget)

    // Assert: ensure the cursor location reflects the final coordinates without timestamps.
    expect(cursor.getLocation()).toEqual({ x: 40, y: 50 })
    expect(client.send).toHaveBeenCalledTimes(6)

    // Assert: confirm the algorithm received sequential start contexts.
    expect(algorithm.contexts[0].start).toEqual({ x: 10, y: 10 })
    expect(algorithm.contexts[1].start).toEqual({ x: 30, y: 30 })
  })
})
