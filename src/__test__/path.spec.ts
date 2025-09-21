import type { TimedVector, Vector } from '../math'
import { path } from '../spoof'

const mockMathRandomSequence = (values: number[]): jest.SpyInstance<number, []> => {
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

describe('path()', () => {
  const start: Vector = { x: 12, y: 24 }
  const end: Vector = { x: 160, y: 96 }

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('produces a deterministic bezier path when randomness is mocked', () => {
    const randomMock = mockMathRandomSequence([0.1, 0.2, 0.3, 0.4, 0.5])

    const vectors = path(start, end, { moveSpeed: 90, spreadOverride: 30 })

    expect(vectors).toHaveLength(28)
    expect(vectors[0]).toEqual({ x: 12, y: 24 })
    expect(vectors[vectors.length - 1]).toEqual({ x: 160, y: 96 })
    expect(vectors).toMatchInlineSnapshot(`
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
        {
          "x": 23.71020049009587,
          "y": 33.8603278036811,
        },
        {
          "x": 26.818102595583305,
          "y": 36.29873947798146,
        },
        {
          "x": 30.039038274587945,
          "y": 38.734173191551555,
        },
        {
          "x": 33.39345391727572,
          "y": 41.17047401935029,
        },
        {
          "x": 36.90179591381255,
          "y": 43.61148703633654,
        },
        {
          "x": 40.58451065436435,
          "y": 46.061057317469185,
        },
        {
          "x": 44.46204452909703,
          "y": 48.52302993770705,
        },
        {
          "x": 48.554843928176496,
          "y": 51.00124997200904,
        },
        {
          "x": 52.88335524176868,
          "y": 53.49956249533404,
        },
        {
          "x": 57.468024860039506,
          "y": 56.0218125826409,
        },
        {
          "x": 62.32929917315486,
          "y": 58.57184530888848,
        },
        {
          "x": 67.48762457128069,
          "y": 61.15350574903567,
        },
        {
          "x": 72.9634474445829,
          "y": 63.77063897804133,
        },
        {
          "x": 78.77721418322739,
          "y": 66.42709007086435,
        },
        {
          "x": 84.9493711773801,
          "y": 69.12670410246358,
        },
        {
          "x": 91.50036481720693,
          "y": 71.87332614779788,
        },
        {
          "x": 98.45064149287377,
          "y": 74.67080128182614,
        },
        {
          "x": 105.82064759454661,
          "y": 77.52297457950726,
        },
        {
          "x": 113.63082951239132,
          "y": 80.43369111580006,
        },
        {
          "x": 121.90163363657382,
          "y": 83.4067959656634,
        },
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

  it('generates monotonic timestamps when requested', () => {
    const randomMock = mockMathRandomSequence([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7])

    jest.useFakeTimers()
    jest.setSystemTime(new Date('2023-11-14T22:13:20.000Z'))

    const vectors = path(start, end, { spreadOverride: 30, useTimestamps: true }) as TimedVector[]

    expect(vectors).toHaveLength(52)
    expect(vectors[0]).toEqual({ x: 12, y: 24, timestamp: 1700000000000 })
    expect(vectors[vectors.length - 1]).toEqual({ x: 160, y: 96, timestamp: 1700000000592 })
    expect(vectors.slice(0, 5)).toMatchInlineSnapshot(`
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
        {
          "timestamp": 1700000000021,
          "x": 16.5560068458665,
          "y": 27.943936942256855,
        },
        {
          "timestamp": 1700000000028,
          "x": 18.094888757693667,
          "y": 29.248798946072174,
        },
      ]
    `)
    expect(vectors.slice(-5)).toMatchInlineSnapshot(`
      [
        {
          "timestamp": 1700000000513,
          "x": 138.79156415643772,
          "y": 89.18597466456337,
        },
        {
          "timestamp": 1700000000532,
          "x": 143.8676592160214,
          "y": 90.85716624886825,
        },
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
    expect(vectors.every((point, index) => index === 0 || point.timestamp >= vectors[index - 1].timestamp)).toBe(true)

    randomMock.mockRestore()
  })

  it('increases path density for harder Fitts-law targets', () => {
    const widthTarget = { x: 300, y: 200, width: 300, height: 150 }
    const narrowTarget = { x: 300, y: 200, width: 40, height: 150 }
    const nearTarget = { x: 150, y: 120, width: 200, height: 150 }
    const farTarget = { x: 480, y: 360, width: 200, height: 150 }

    const vectorsFor = (target: typeof widthTarget): Vector[] => {
      const randomMock = mockMathRandomSequence([0.1, 0.2, 0.3, 0.4, 0.5])
      try {
        return path(start, target, { moveSpeed: 90, spreadOverride: 30 }) as Vector[]
      } finally {
        randomMock.mockRestore()
      }
    }

    const wide = vectorsFor(widthTarget)
    const narrow = vectorsFor(narrowTarget)
    const near = vectorsFor(nearTarget)
    const far = vectorsFor(farTarget)

    expect(narrow.length).toBeGreaterThan(wide.length)
    expect(far.length).toBeGreaterThan(near.length)
    expect(wide[0]).toEqual(start)
    expect(far[far.length - 1].x).toBeCloseTo(farTarget.x, 6)
    expect(far[far.length - 1].y).toBeCloseTo(farTarget.y, 6)
  })
})
