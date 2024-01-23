import {
  AnyThreadChannel,
  ChannelType,
  FetchArchivedThreadOptions,
  NonThreadGuildBasedChannel,
  TextChannel,
  ThreadAutoArchiveDuration,
  ThreadChannel
} from 'discord.js'
import {
  MessageableGuildChannel,
  ThreadableGuildChannel
} from './types/channels'
import { DateFilteringOptions } from './types/date-filtering-options'
import { isDeleted } from './deletion-cache'
import { Bot } from '../core/bot'
import { getDateString, getFilteringDateString, pause } from '../core/utils'

export async function fetchLogChannel(bot: Bot): Promise<TextChannel> {
  const logChannelId = bot.config.LOG_CHANNEL_ID
  const channel = (await bot.client.channels.fetch(logChannelId)) as TextChannel

  if (!channel) {
    throw new Error(`There is no channel with the ID ${logChannelId}`)
  }

  // Ignore anything that isn't a text channel
  if (channel.type !== ChannelType.GuildText) {
    throw new Error(`The log channel, ${logChannelId}, must be a text channel`)
  }

  if (!channel.viewable) {
    throw new Error(`The log channel, ${logChannelId}, is not viewable`)
  }

  return channel
}

export async function fetchReportSpamChannel(bot: Bot): Promise<TextChannel> {
  const reportSpamChannelId = bot.config.REPORT_SPAM_CHANNEL_ID
  const channel = (await bot.client.channels.fetch(
    reportSpamChannelId
  )) as TextChannel

  if (!channel) {
    throw new Error(`There is no channel with the ID ${reportSpamChannelId}`)
  }

  // Ignore anything that isn't a text channel
  if (channel.type !== ChannelType.GuildText) {
    throw new Error(
      `The spam reporting channel, ${reportSpamChannelId}, must be a text channel`
    )
  }

  if (!channel.viewable) {
    throw new Error(
      `The spam reporting channel, ${reportSpamChannelId}, is not viewable`
    )
  }

  return channel
}

export async function loadMessageableChannels(bot: Bot) {
  const viewableChannels = await loadViewableChannels(bot)
  const messageableChannels: MessageableGuildChannel[] = []

  for (const channel of viewableChannels) {
    if (channel.isTextBased() && channel.messages) {
      messageableChannels.push(channel)
    }
  }

  return messageableChannels
}

export async function loadThreadableChannels(bot: Bot) {
  const viewableChannels = await loadViewableChannels(bot)
  const threadableChannels: ThreadableGuildChannel[] = []

  for (const channel of viewableChannels) {
    if (
      (channel.isTextBased() || channel.isThreadOnly()) &&
      !channel.isVoiceBased() &&
      channel.threads
    ) {
      threadableChannels.push(channel)
    }
  }

  return threadableChannels
}

async function loadViewableChannels(bot: Bot) {
  const channels = await bot.guild.channels.fetch()
  const viewableChannels: NonThreadGuildBasedChannel[] = []

  channels.forEach(channel => {
    if (channel && channel.viewable) {
      viewableChannels.push(channel)
    }
  })

  return viewableChannels
}

const threadCache: Record<string, ThreadChannel> = {}

export async function getThreadByName(channel: TextChannel, name: string) {
  const thread = threadCache[name]

  if (thread && !isDeleted(thread)) {
    return thread
  }

  // Try active threads first, then archived threads, then active threads again. We need to check active threads twice
  // to handle the race condition where a channel gets activated between the first and second requests. This can
  // happen if the bot is trying to send multiple messages to the same thread at roughly the same time.
  const archivedValues = [undefined, {}, undefined]

  for (const archived of archivedValues) {
    const { threads } = await channel.threads.fetch({ archived })

    const thread = threads.find(th => th.name === name)

    if (thread) {
      threadCache[name] = thread

      return thread
    }
  }
}

export async function useThread(
  channel: TextChannel,
  name: string,
  options?: { autoArchiveDuration?: ThreadAutoArchiveDuration; reason?: string }
) {
  let thread = await getThreadByName(channel, name)

  if (!thread) {
    thread = await channel.threads.create({
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      ...options,
      name
    })
  }

  return thread
}

const createDateChecks = ({
  startDay = 0,
  endDay = 0
}: DateFilteringOptions) => {
  const earliestDate = getFilteringDateString(startDay)
  const latestDate = getFilteringDateString(endDay)

  // We don't necessarily have access to the messages, so we approximate with the timestamps. Anything using these
  // threads will need to check the messages to confirm whether they are in the date range.
  const isTooOld = (thread: AnyThreadChannel) =>
    thread.archiveTimestamp &&
    getDateString(thread.archiveTimestamp) < earliestDate
  const isTooNew = (thread: AnyThreadChannel) =>
    thread.createdTimestamp &&
    getDateString(thread.createdTimestamp) > latestDate

  const isInDateRange = (thread: AnyThreadChannel) =>
    !isTooNew(thread) && !isTooOld(thread)

  return {
    isTooOld,
    isTooNew,
    isInDateRange
  }
}

export async function* loadThreadsFor(
  channel: ThreadableGuildChannel,
  filteringOptions: DateFilteringOptions = {}
) {
  const { isTooOld, isInDateRange } = createDateChecks(filteringOptions)

  // Active threads can all be loaded in a single call
  const activeThreads = await channel.threads.fetchActive()

  for (const thread of activeThreads.threads.values()) {
    if (isInDateRange(thread)) {
      yield thread
    }
  }

  let lastThread: AnyThreadChannel | null | undefined = null
  let queryCount = 1000

  // Archived threads are paged, so we load the pages in a loop
  while (true) {
    const params: FetchArchivedThreadOptions = {
      limit: 100
    }

    if (lastThread !== null) {
      params.before = lastThread
    }

    const pageOfThreads = await channel.threads.fetchArchived(params)

    for (const thread of pageOfThreads.threads.values()) {
      if (isInDateRange(thread)) {
        yield thread
      }
    }

    lastThread = pageOfThreads.threads.last()

    if (!pageOfThreads.hasMore || !lastThread || isTooOld(lastThread)) {
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
