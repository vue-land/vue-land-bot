import {
  FetchMessagesOptions,
  Message,
  MessageType,
  ThreadChannel
} from 'discord.js'
import { MessageableGuildChannel } from './types/channels'
import { MessageFilteringOptions } from './types/message-filtering-options'
import { getDateString, getFilteringDateString, pause } from '../core/utils'

const PAGE_SIZE = 100

const createDateChecks = ({
  startDay = 0,
  endDay = 0
}: MessageFilteringOptions) => {
  const earliestDate = getFilteringDateString(startDay)
  const latestDate = getFilteringDateString(endDay)

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
  channel: MessageableGuildChannel | ThreadChannel,
  filteringOptions: MessageFilteringOptions = {}
) {
  const { isTooOld, isInDateRange } = createDateChecks(filteringOptions)

  let lastMessage = null
  let queryCount = 1000

  while (true) {
    const params: FetchMessagesOptions = { limit: PAGE_SIZE }

    if (lastMessage !== null) {
      params.before = lastMessage.id
    }

    const pageOfMessages = await channel.messages.fetch(params)

    for (const message of pageOfMessages.values()) {
      if (
        isInDateRange(message) &&
        [MessageType.Default, MessageType.Reply].includes(message.type)
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
