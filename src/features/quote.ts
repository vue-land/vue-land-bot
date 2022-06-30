import consola from 'consola'
import { ApplicationCommandOptionType } from 'discord-api-types/v9'
import {
  BaseGuildTextChannel,
  Message,
  MessageEmbedOptions,
  PartialMessage
} from 'discord.js'
import { loadTextChannels } from '../api/channels'
import { feature } from '../core/feature'

const CHANNEL_NAMES = ['welcome', 'related-discords', 'how-to-get-help']
const channelsCache: BaseGuildTextChannel[] = []

const isMyMessage = (message: Message | PartialMessage) => {
  const botUserId = message.client.user?.id
  const messageAuthorId = message.author?.id

  return messageAuthorId != null && messageAuthorId === botUserId
}

export default feature({
  commands: {
    name: 'quote',
    roles: 'trusted',
    description:
      'Quote a message from #welcome, #related-discords or #how-to-get-help',
    options: [
      {
        name: 'message',
        description: 'URL or message id of the message to quote',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'text',
        description: 'Custom text to show before the quote',
        type: ApplicationCommandOptionType.String
      }
    ],
    action: async (bot, interaction) => {
      const content = interaction.options.getString('text')
      const chunks = interaction.options
        .getString('message', true)
        .trim()
        .split('/')
      const messageId = chunks.pop() || ''
      const channelId = chunks.pop()

      if (!/^\d+$/.test(messageId)) {
        return interaction.reply({
          content: `Failed. The message id could not be parsed.`,
          ephemeral: true
        })
      }

      if (!channelsCache.length) {
        const channels = await loadTextChannels(bot)

        for (const channel of channels) {
          if (CHANNEL_NAMES.includes(channel.name)) {
            channelsCache.push(channel)
          }
        }
      }

      let message = null

      for (const channel of channelsCache) {
        if (!channelId || channel.id === channelId) {
          try {
            message = await channel.messages.fetch(messageId)
            break
          } catch {}
        }
      }

      if (message) {
        const messageContent = message.content.replace(/[\u200b\n]+$/, '')

        const embed: MessageEmbedOptions = {
          color: '#1971c2',
          description: `**From [#${(message.channel as any).name}](${
            message.url
          }):**\n\n${messageContent}`
        }

        await interaction.reply({
          content,
          embeds: [embed],
          allowedMentions: {
            parse: ['users']
          }
        })
      } else {
        await interaction.reply({
          content: `Failed. The message could not be found. Quoting only supports these channels:\n${channelsCache
            .map(ch => ':small_blue_diamond: <#' + ch.id + '>')
            .join('\n')}`,
          ephemeral: true
        })
      }
    }
  },

  events: {
    async messageReactionAdd(bot, reaction, user) {
      const { message } = reaction
      const { interaction } = message

      // Check the reaction is on a quote message
      if (
        !interaction ||
        interaction.commandName !== 'quote' ||
        !isMyMessage(message)
      ) {
        return
      }

      // Check that the user who added the reaction is the same user who requested the quote
      if (interaction.user !== user) {
        return
      }

      const emojiName = reaction.emoji.name

      if (emojiName && ['🔥', '🗑️', '❌', '💣', '🧨'].includes(emojiName)) {
        consola.log(`Deleting quoted message for ${user.tag}`)
        await message.delete()
      }
    }
  }
})
