import type { Page } from 'puppeteer'
import { GhostCursor } from '../spoof'
import type { Vector } from '../math'

describe('GhostCursor.moveTo', () => {
  const createPageMock = (send: jest.Mock): Page => {
    const client = { send } as unknown
    const page = {
      _client: () => client,
      browser: () => ({ isConnected: () => true })
    }
    return page as unknown as Page
  }

  afterEach(() => {
    jest.useRealTimers()
  })

  it('dispatches path vectors in order and tracks cursor position across moves', async () => {
    const initialLocation: Vector = { x: 25, y: 40 }
    const firstDestination: Vector = { x: 80, y: 120 }
    const secondDestination: Vector = { x: 150, y: 190 }

    const send = jest.fn().mockResolvedValue(undefined)
    const page = createPageMock(send)
    const cursor = new GhostCursor(page, { start: initialLocation })

    expect(cursor.getLocation()).toEqual(initialLocation)

    await cursor.moveTo(firstDestination, {
      moveDelay: 0,
      randomizeMoveDelay: false,
      moveSpeed: 90,
      spreadOverride: 30
    })

    const firstMoveCalls = send.mock.calls.slice()
    expect(firstMoveCalls.length).toBeGreaterThanOrEqual(2)
    expect(firstMoveCalls[0][1]).toMatchObject({ x: initialLocation.x, y: initialLocation.y })
    expect(firstMoveCalls[firstMoveCalls.length - 1][1]).toMatchObject({
      x: firstDestination.x,
      y: firstDestination.y
    })
    expect(cursor.getLocation()).toMatchObject(firstDestination)

    jest.useFakeTimers()
    jest.setSystemTime(new Date('2023-11-14T22:13:20.000Z'))

    const beforeSecondMove = send.mock.calls.length
    await cursor.moveTo(secondDestination, {
      moveDelay: 0,
      randomizeMoveDelay: false,
      moveSpeed: 90,
      spreadOverride: 30,
      useTimestamps: true
    })

    const secondMoveCalls = send.mock.calls.slice(beforeSecondMove)
    expect(secondMoveCalls.length).toBeGreaterThanOrEqual(2)

    const [firstSecondMove] = secondMoveCalls
    expect(firstSecondMove[1]).toMatchObject({
      x: firstDestination.x,
      y: firstDestination.y
    })
    expect(firstSecondMove[1].timestamp).toBeGreaterThanOrEqual(1700000000000)

    const lastSecondMove = secondMoveCalls[secondMoveCalls.length - 1][1]
    expect(lastSecondMove).toMatchObject({ x: secondDestination.x, y: secondDestination.y })
    expect(typeof lastSecondMove.timestamp).toBe('number')

    const timestamps = secondMoveCalls.map(([, params]) => params.timestamp ?? 0)
    timestamps.slice(1).forEach((timestamp, index) => {
      expect(timestamp).toBeGreaterThanOrEqual(timestamps[index])
    })

    expect(cursor.getLocation()).toMatchObject({
      x: secondDestination.x,
      y: secondDestination.y,
      timestamp: lastSecondMove.timestamp
    })
  })
})
