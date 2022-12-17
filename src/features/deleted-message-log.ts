import { EmbedBuilder, Message, PartialMessage } from 'discord.js'
import { fetchLogChannel, useThread } from '../api/channels'
import { Bot } from '../core/bot'
import { events } from '../core/feature'
import { logger } from '../core/utils'

export default events({
  async messageDelete(bot, message) {
    await logDeletedMessages(bot, [message])
  },

  async messageDeleteBulk(bot, messages) {
    await logDeletedMessages(bot, [...messages.values()])
  }
})

const logDeletedMessages = async (
  bot: Bot,
  messages: (Message | PartialMessage)[]
) => {
  const logChannel = await fetchLogChannel(bot)
  const deletedMessagesThread = await useThread(logChannel, 'DELETED_MESSAGES')

  const message = messages[0]
  const count = messages.length

  if (!message) {
    throw new Error(`Assertion failure: no deleted message provided`)
  }

  if (message.channel.id === deletedMessagesThread.id) {
    logger.info(
      `${count} message${count === 1 ? '' : 's'} deleted from ${
        deletedMessagesThread.name
      }`
    )
    return
  }

  const embed = new EmbedBuilder()
    .setColor('#e03131')
    .setTimestamp(message.createdAt)

  if (count === 1) {
    const { author } = message

    if (author) {
      embed.setAuthor({
        name: author.tag,
        iconURL: author.displayAvatarURL()
      })
    }

    embed.setDescription(`
      **Message from <@${author?.id}> deleted in** <#${message.channel.id}>
      ${message.content}
    `)
  } else {
    const joinedMessages = messages
      .map(message => `[<@${message.author?.id}>]: ${message.content}`)
      .join('\n')

    embed.setDescription(`
      **${count}** messages deleted in <#${message.channel.id}>
      ${joinedMessages}
    `)
  }

  await deletedMessagesThread.send({ embeds: [embed] })
}
