import consola from 'consola'
import { Message, PartialMessage } from 'discord.js'
import { events } from '../core/feature'

const isMyMessage = (message: Message | PartialMessage) => {
  const botUserId = message.client.user?.id
  const messageAuthorId = message.author?.id

  return messageAuthorId != null && messageAuthorId === botUserId
}

export default events({
  async messageReactionAdd(bot, reaction, user) {
    const { message } = reaction
    const { interaction } = message

    // Check the reaction is on an interaction response from this bot
    if (
      !interaction ||
      interaction.type !== 'APPLICATION_COMMAND' ||
      !interaction.commandName ||
      !isMyMessage(message)
    ) {
      return
    }

    // Check that the user who added the reaction is the same user who requested the quote
    if (interaction.user !== user) {
      return
    }

    const emojiName = reaction.emoji.name

    if (emojiName && ['๐ฅ', '๐๏ธ', 'โ', '๐ฃ', '๐งจ'].includes(emojiName)) {
      consola.log(
        `Deleting /${interaction.commandName} message for ${user.tag}`
      )
      await message.delete()
    }
  }
})
