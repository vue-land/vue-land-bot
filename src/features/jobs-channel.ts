import { Message, MessageEmbedOptions, TextChannel } from 'discord.js'
import { fetchLogChannel, useThread } from '../api/channels'
import { loadMessagesFor } from '../api/messages'
import { Bot } from '../core/bot'
import { events } from '../core/feature'

const messageCache = new Map<string, Message>()

async function updateMessageCache(channel: TextChannel) {
  if (!messageCache.size) {
    const asyncMessages = loadMessagesFor(channel, { startDay: -7 })
    const messages = []

    for await (const message of asyncMessages) {
      if (!message.author.bot && message.type === 'DEFAULT') {
        messages.push(message)
      }
    }

    // This extra step is to mitigate problems arising from the race condition that could occur if two messages
    // come in at roughly the same time, potentially leading to the loading process running twice
    for (const message of messages) {
      messageCache.set(message.id, message)
    }
  }

  const cutOffTime = Date.now() - 7 * 24 * 60 * 60 * 1000

  for (const message of messageCache.values()) {
    if (message.createdTimestamp < cutOffTime) {
      messageCache.delete(message.id)
    }
  }
}

const formatDuration = (duration: number) => {
  if (duration < 60) {
    return duration + 's'
  }

  duration /= 60

  if (duration < 60) {
    return Math.floor(duration) + 'm'
  }

  duration /= 60

  if (duration < 24) {
    return Math.floor(duration) + 'h'
  }

  const days = Math.floor(duration / 24)

  return days + 'd, ' + Math.floor(duration - days * 24) + 'h'
}

const postLogMessage = async (
  bot: Bot,
  messages: Message[],
  reason: string
) => {
  const logChannel = await fetchLogChannel(bot)

  // Use the last message as the reference point as that's the one that triggered the violation
  const message = messages[messages.length - 1]
  const time = message.createdTimestamp

  const messageList = messages.slice(-20).map(msg => {
    const timeDifference = Math.round((time - msg.createdTimestamp) / 1000)
    return `:small_orange_diamond: [${formatDuration(timeDifference)} ago](${
      msg.url
    })`
  })

  const embed: MessageEmbedOptions = {
    color: '#fcc419',
    author: {
      name: message.author.tag,
      icon_url: message.author.displayAvatarURL()
    },
    title: reason,
    description: messageList.join('\n'),
    timestamp: new Date(),
    footer: {
      text: `User ID: ${message.author.id}`
    }
  }

  const thread = await useThread(logChannel, 'JOBS_MODERATION')

  await thread.send({ embeds: [embed] })
}

export default events({
  async messageCreate(bot, message) {
    // Ignore bots and replies
    if (message.author.bot || message.type !== 'DEFAULT') {
      return
    }

    const channel = message.channel

    if (
      channel.type !== 'GUILD_TEXT' ||
      channel.name.toLowerCase() !== 'jobs'
    ) {
      return
    }

    await updateMessageCache(channel)

    messageCache.set(message.id, message)

    const matches = [message]
    const authorId = message.author.id
    const timestamp = message.createdTimestamp

    for (const cachedMessage of messageCache.values()) {
      // The timestamp check stops the message matching itself, or messages posted while populating the cache
      if (
        cachedMessage.author.id === authorId &&
        cachedMessage.createdTimestamp < timestamp
      ) {
        matches.push(cachedMessage)
      }
    }

    if (matches.length > 1) {
      matches.sort((a, b) => a.createdTimestamp - b.createdTimestamp)

      await postLogMessage(bot, matches, 'Multiple messages within 7 days')
    }
  }
})
