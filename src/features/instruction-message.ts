import { Message, MessageEmbedOptions, TextChannel } from 'discord.js'
import { events } from '../core/feature'
import { debounce, withErrorLogging } from '../core/utils'

// This is used as a way to identify which message to delete. It doesn't use the 'usual' #fcc419, helping to ensure we
// don't accidentally delete a different message. Checking the message text would make it more difficult to change.
const embedColor = '#fcc418'

const createInstructionMessage = (channelName: string, messageText: string) => {
  let lastMessage: Message | null = null

  const repostMessage = async (channel: TextChannel) => {
    let messageToDelete = lastMessage
    lastMessage = null

    if (messageToDelete && messageToDelete.deleted) {
      messageToDelete = null
    }

    if (!messageToDelete) {
      const recentMessages = await channel.messages.fetch({ limit: 100 })
      const botUserId = channel.client.user?.id

      for (const message of recentMessages.values()) {
        if (message.author.id === botUserId && message.deletable) {
          const embeds = message.embeds

          if (
            embeds &&
            embeds.length === 1 &&
            embeds[0].hexColor === embedColor
          ) {
            messageToDelete = message
            break
          }
        }
      }
    }

    const embed: MessageEmbedOptions = {
      color: embedColor,
      description: messageText
    }

    const postNewMessage = async () => {
      lastMessage = await channel.send({ embeds: [embed] })
    }

    const promises: Promise<unknown>[] = [postNewMessage()]

    if (messageToDelete) {
      promises.push(messageToDelete.delete())
    }

    // For error handling we need to wait for both promises
    await Promise.all(promises)
  }

  // Debouncing helps to avoid race conditions if multiple messages come in at the same time
  const repostMessageDebounced = debounce(
    withErrorLogging(
      `Updating #${channelName} instruction message`,
      repostMessage
    ),
    10 * 1000
  )

  return async (message: Message) => {
    const channel = message.channel

    if (
      channel.type !== 'GUILD_TEXT' ||
      channel.name.toLowerCase() !== channelName ||
      !channel.viewable
    ) {
      return
    }

    repostMessageDebounced(channel)
  }
}

const handlers = [
  createInstructionMessage(
    'jobs',
    ':pushpin: Please read [the pinned message](https://discord.com/channels/325477692906536972/325675277046906881/938461542775685140) before posting in this channel'
  ),
  createInstructionMessage(
    'pinia',
    ':pushpin: Please read [the pinned message](https://discord.com/channels/325477692906536972/911637879212625971/911643741280956486) before posting in this channel'
  )
]

export default events({
  async messageCreate(bot, message) {
    if (message.author.id === bot.client.user.id) {
      return
    }

    for (const handler of handlers) {
      await handler(message)
    }
  }
})
