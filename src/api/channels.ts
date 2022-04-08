import {
  BaseGuildTextChannel,
  Guild,
  TextChannel,
  ThreadAutoArchiveDuration,
  ThreadChannel
} from 'discord.js'
import { Bot } from '../core/bot'

export async function fetchLogChannel(bot: Bot): Promise<TextChannel> {
  const logChannelId = bot.config.LOG_CHANNEL_ID
  const channel = (await bot.client.channels.fetch(logChannelId)) as TextChannel

  if (!channel) {
    throw new Error(`There is no channel with the ID ${logChannelId}`)
  }

  // Ignore anything that isn't a text channel
  if (channel.type !== 'GUILD_TEXT') {
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
  if (channel.type !== 'GUILD_TEXT') {
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

export async function loadTextChannels(bot: Bot) {
  return loadTextChannelsForGuild(bot.guild)
}

export async function loadTextChannelsForGuild(guild: Guild) {
  const channels = await guild.channels.fetch()
  const textChannels: BaseGuildTextChannel[] = []

  channels.forEach(channel => {
    if (channel.isText() && channel.viewable) {
      textChannels.push(channel)
    }
  })

  return textChannels
}

const threadCache: Record<string, ThreadChannel> = {}

export async function getThreadByName(channel: TextChannel, name: string) {
  const thread = threadCache[name]

  if (thread && !thread.deleted) {
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
      autoArchiveDuration: 'MAX',
      ...options,
      name
    })
  }

  return thread
}
