import { BaseGuildTextChannel, User } from 'discord.js'
import { MessageFilteringOptions } from './types/message-filtering-options'
import { fetchLogChannel, loadTextChannels, useThread } from './channels'
import { loadMessagesFor } from './messages'
import { Bot } from '../core/bot'

export interface MessageCount {
  id: string
  messageCount: number
  name: string
}

export async function postCountsAsRanking(
  bot: Bot,
  title: string,
  messageCounts: MessageCount[]
) {
  const sorted = [...messageCounts]
    .filter(({ messageCount }) => messageCount > 0)
    .sort((a, b) => b.messageCount - a.messageCount)

  if (!sorted.length) {
    return
  }

  // Cap at 50. The longest name length shouldn't include names so far down that they won't be shown.
  sorted.length = Math.min(sorted.length, 50)

  const largestCount = sorted[0].messageCount

  let messageContent = '**' + title + '**\n```\n'

  const longestCountLength = `${largestCount}`.length
  const longestNameLength = Math.max(...sorted.map(({ name }) => name.length))

  let position = 1
  const MAX_BAR_SIZE = 30

  for (const { name, messageCount } of sorted) {
    const paddedPosition = `${position}`.padStart(2, ' ')
    const paddedCount = `${messageCount}`.padStart(longestCountLength, ' ')
    const paddedName = `${name}`.padEnd(longestNameLength, ' ')

    const barSize = Math.round((MAX_BAR_SIZE * messageCount) / largestCount)

    const barFill = ''.padStart(barSize, '#').padEnd(MAX_BAR_SIZE, ' ')
    const bar = barSize ? ` - [${barFill}]` : ''

    messageContent +=
      `${paddedPosition}. ${paddedCount} - ${paddedName}${bar}`.trimEnd() + '\n'

    // Limit is 2000
    if (messageContent.length > 1900) {
      break
    }

    ++position
  }

  messageContent += '```'

  const logChannel = await fetchLogChannel(bot)

  const thread = await useThread(logChannel, 'STATISTICS')

  await thread.send({
    content: messageContent
  })
}

export async function loadMessageStatistics(
  bot: Bot,
  filteringOptions: MessageFilteringOptions
) {
  const textChannels = await loadTextChannels(bot)

  const postCountsByAuthor: Record<string, number> = Object.create(null)
  const postCountsByChannel: Record<string, number> = Object.create(null)
  const authors: Record<string, User> = Object.create(null)
  const channels: Record<string, BaseGuildTextChannel> = Object.create(null)

  let threadCount = 0
  let activeThreadCount = 0
  let activeChannelCount = 0
  let messageCount = 0

  for (const channel of textChannels) {
    const channelId = channel.id
    postCountsByChannel[channelId] = 0
    channels[channelId] = channel

    const { threads: activeThreads } = await channel.threads.fetch()
    const { threads: archiveThreads } = await channel.threads.fetch({
      archived: {}
    })

    threadCount += activeThreads.size + archiveThreads.size

    const threads = [
      channel,
      ...activeThreads.values(),
      ...archiveThreads.values()
    ]

    let activeChannel = false

    for (const thread of threads) {
      let activeThread = false

      const asyncMessages = loadMessagesFor(thread, filteringOptions)

      for await (const message of asyncMessages) {
        const { author } = message

        if (author.bot) {
          continue
        }

        const authorId = author.id

        if (!authors[authorId]) {
          authors[authorId] = author
          postCountsByAuthor[authorId] = 0
        }

        ++postCountsByAuthor[authorId]
        ++postCountsByChannel[channelId]
        ++messageCount
        activeChannel = true
        activeThread = true
      }

      if (activeThread && thread !== channel) {
        ++activeThreadCount
      }
    }

    if (activeChannel) {
      ++activeChannelCount
    }
  }

  const authorsList: MessageCount[] = Object.keys(authors).map(authorId => {
    const { username } = authors[authorId]

    return {
      id: authorId,
      messageCount: postCountsByAuthor[authorId],
      name: username
    }
  })

  const channelsList: MessageCount[] = Object.keys(channels).map(channelId => {
    const { name } = channels[channelId]

    return {
      id: channelId,
      messageCount: postCountsByChannel[channelId],
      name
    }
  })

  return {
    users: authorsList,
    channels: channelsList,
    totals: {
      activeTextChannels: activeChannelCount,
      textChannels: textChannels.length,
      threads: threadCount,
      activeThreads: activeThreadCount,
      messages: messageCount
    }
  }
}
