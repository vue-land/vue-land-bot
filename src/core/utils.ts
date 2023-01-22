import consola from 'consola'
import { Awaitable, Message, MessageType, PartialMessage } from 'discord.js'

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

export function isMyMessage(message: Message | PartialMessage): boolean {
  const botUserId = message.client.user?.id
  const messageAuthorId = message.author?.id

  return messageAuthorId != null && messageAuthorId === botUserId
}

export function isNormalUserMessage(
  message: Message | PartialMessage
): boolean {
  const { author, system, type } = message

  return (
    !!author &&
    !author.bot &&
    !author.system &&
    !system &&
    (type === MessageType.Default || type === MessageType.Reply)
  )
}
