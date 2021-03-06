import consola from 'consola'
import { Awaitable } from 'discord.js'

export const logger = consola.create({})

export function toArray<T>(value: T | T[]): T[] {
  if (Array.isArray(value)) {
    return value
  } else {
    return [value]
  }
}

// Promise-based wrapper for setTimeout, intended to be used with async/await to pause execution
export async function pause(delayMs: number) {
  return new Promise(resolve => {
    setTimeout(resolve, delayMs)
  })
}

export function debounce<T extends Array<any>>(
  fn: (...args: T) => void,
  duration: number
) {
  let timerId: NodeJS.Timeout | null = null

  return (...args: T) => {
    if (timerId) {
      clearTimeout(timerId)
    }

    timerId = setTimeout(async () => {
      fn(...args)
    }, duration)
  }
}

export function withErrorLogging<T extends Array<any>>(
  taskName: string,
  fn: (...args: T) => Awaitable<void>
) {
  return async (...args: T) => {
    try {
      await fn(...args)
    } catch (err) {
      logger.error(`${taskName} failed:`, err)
    }
  }
}
