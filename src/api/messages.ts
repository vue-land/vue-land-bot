import {
  BaseGuildTextChannel,
  ChannelLogsQueryOptions,
  Message,
  ThreadChannel
} from 'discord.js'
import { MessageFilteringOptions } from './types/message-filtering-options'
import { pause } from '../core/utils'

const PAGE_SIZE = 100
const MS_PER_DAY = 24 * 60 * 60 * 1000

// This may look complicated, but it just checks that the string is plausibly a date in the correct format. It's
// intended to protect against mistakes during development.
const DATE_STRING_RE = /^(2\d\d\d-[01]\d-[0123]\d)(?:$|T)/

const getDateString = (timestamp: string | number | Date) => {
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

const createDateChecks = ({
  startDay = 0,
  endDay = 0
}: MessageFilteringOptions) => {
  const now = Date.now()

  const [earliestDate, latestDate] = [startDay, endDay].map(day => {
    // Treat numbers 0 or below as day offsets, rather than epoch times
    if (typeof day === 'number' && day <= 0) {
      day = now + day * MS_PER_DAY
    }

    return getDateString(day)
  })

  const isTooOld = (message: Message) =>
    getDateString(message.createdTimestamp) < earliestDate
  const isTooNew = (message: Message) =>
    getDateString(message.createdTimestamp) > latestDate

  const isInDateRange = (message: Message) =>
    !isTooNew(message) && !isTooOld(message)

  return {
    isTooOld,
    isTooNew,
    isInDateRange
  }
}

export async function* loadMessagesFor(
  channel: BaseGuildTextChannel | ThreadChannel,
  filteringOptions: MessageFilteringOptions = {}
) {
  const { isTooOld, isInDateRange } = createDateChecks(filteringOptions)

  let lastMessage = null
  let queryCount = 1000

  while (true) {
    const params: ChannelLogsQueryOptions = { limit: PAGE_SIZE }

    if (lastMessage !== null) {
      params.before = lastMessage.id
    }

    const pageOfMessages = await channel.messages.fetch(params)

    for (const message of pageOfMessages.values()) {
      if (
        isInDateRange(message) &&
        ['DEFAULT', 'REPLY'].includes(message.type)
      ) {
        yield message
      }
    }

    lastMessage = pageOfMessages.last()

    if (
      pageOfMessages.size !== PAGE_SIZE ||
      !lastMessage ||
      isTooOld(lastMessage)
    ) {
      break
    }

    --queryCount

    if (queryCount === 0) {
      throw new Error(
        `Too many queries, aborting. Channel ${channel.id}, ${JSON.stringify(
          filteringOptions
        )}`
      )
    }

    // Wait for 50ms between queries to avoid hitting a rate limit
    await pause(50)
  }
}
