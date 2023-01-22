import {
  ChannelType,
  EmbedBuilder,
  ForumChannel,
  Message,
  TextBasedChannel,
  TextChannel,
  ThreadChannel
} from 'discord.js'
import { events } from '../core/feature'
import { isMyMessage, isNormalUserMessage, logger, pause } from '../core/utils'

const messageText =
  'This thread has been automatically created for your question. Please post any follow-up messages here, rather than in the main channel.'

const isAutoThreadChannel = (
  channel: TextBasedChannel | ForumChannel | null
): channel is TextChannel => {
  return (
    !!channel &&
    channel.type === ChannelType.GuildText &&
    channel.name.toLowerCase() === 'pinia' &&
    channel.viewable
  )
}

const isInfoMessage = (message: Message) => {
  const { embeds } = message

  return (
    isMyMessage(message) &&
    message.deletable &&
    embeds &&
    embeds.length === 1 &&
    embeds[0].description === messageText
  )
}

const ignoreThreads = new WeakSet<ThreadChannel>()

async function deleteInfoMessage(channel: ThreadChannel) {
  // If we've already deleted the info message there's no need to do it again
  if (ignoreThreads.has(channel)) {
    return
  }

  ignoreThreads.add(channel)

  const recentMessages = await channel.messages.fetch({ limit: 10 })

  let messageToDelete: Message | null = null

  for (const message of recentMessages.values()) {
    if (isInfoMessage(message)) {
      messageToDelete = message
      break
    }
  }

  if (messageToDelete) {
    await messageToDelete.delete()
  }
}

export default events({
  async messageCreate(bot, message) {
    if (!isNormalUserMessage(message)) {
      return
    }

    const { channel } = message

    if (
      channel.type === ChannelType.PublicThread &&
      isAutoThreadChannel(channel.parent)
    ) {
      await deleteInfoMessage(channel)
      return
    }

    if (!isAutoThreadChannel(channel)) {
      return
    }

    // If someone creates a thread directly it won't initially be marked as having a thread. In practice, the earlier
    // checks on the message should stop us getting here anyway in that scenario, which is why we log a warning.
    await pause(250)

    if (message.hasThread) {
      logger.warn(
        `Message ${message.id} in #${channel.name} already has a thread`
      )
      return
    }

    const name =
      bot.guild.members.resolve(message.author)?.nickname ??
      message.author.username

    const thread = await message.startThread({
      autoArchiveDuration: 1440,
      name
    })

    const embed = new EmbedBuilder()
      .setDescription(messageText)
      .setColor('#1971c2')

    await thread.send({ embeds: [embed] })
  }
})
