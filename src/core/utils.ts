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

export function debounce<T extends Array<unknown>>(
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

export function withErrorLogging<T extends Array<unknown>>(
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

// The spoiler hack hides parts of a message:
// - https://www.reddit.com/r/discordapp/comments/uiohaz/someone_managed_to_ping_me_and_other_people_with/
// It is used by spammers to hide invites or tags at the end of a message.
// We need to remove it from any messages posted by the bot.
export function replaceSpoilerHack(
  messageContent: string | null,
  replacement = '[...]'
) {
  return (messageContent ?? '').replace(/(\|\|\u200b\|\|)+/g, replacement)
}

// This may look complicated, but it just checks that the string is plausibly a date in the correct format. It's
// intended to protect against mistakes during development.
const DATE_STRING_RE = /^(2\d\d\d-[01]\d-[0123]\d)(?:$|T)/

export const getDateString = (timestamp: string | number | Date) => {
  let normalizedTimestamp = timestamp

  if (typeof normalizedTimestamp === 'number') {
    normalizedTimestamp = new Date(normalizedTimestamp)
  }

  if (normalizedTimestamp instanceof Date) {
    normalizedTimestamp = normalizedTimestamp.toISOString()
  }

  const dateStringMatch = normalizedTimestamp.match(DATE_STRING_RE)

  if (dateStringMatch) {
    return dateStringMatch[1]
  }

  throw new Error(
    `Could not parse date string for ${typeof timestamp} ${timestamp}`
  )
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getFilteringDateString(day: string | number | Date) {
  // Treat numbers 0 or below as day offsets, rather than epoch times
  if (typeof day === 'number' && day <= 0) {
    day = Date.now() + day * MS_PER_DAY
  }

  return getDateString(day)
}
