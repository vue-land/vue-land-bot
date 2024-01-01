import { ApplicationCommandOptionType } from 'discord-api-types/v9'
import { EmbedBuilder, Message } from 'discord.js'
import { MessageableGuildChannel } from '../api/types/channels'
import { loadMessageableChannels } from '../api/channels'
import { isDeleted } from '../api/deletion-cache'
import { command } from '../core/feature'
import { logger } from '../core/utils'
import { getAsset } from '../fs/assets'

const CHANNEL_NAME = 'how-to-get-help'
const START_TEXT = '## Other advice'

const numbers = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine'
]

export default command(async () => {
  let rulesText = await getAsset(`${CHANNEL_NAME}.md`)

  const otherAdviceIndex = rulesText.indexOf(START_TEXT)

  if (otherAdviceIndex === -1) {
    logger.warn(`Unable to find text "${START_TEXT}" in ${CHANNEL_NAME}.md`)
  } else {
    rulesText = rulesText.slice(otherAdviceIndex)
  }

  const lines = rulesText.split('\n').map(line => line.trim())

  const rules: Record<string, string> = Object.create(null)
  const choices: { name: string; value: string }[] = []

  for (const line of lines) {
    // Grab the number emoji from the beginning of the line
    const matches = line.match(/^:([a-z]+):/)

    if (matches) {
      const numberName = matches[1]
      const number = numbers.indexOf(numberName) + 1

      if (number) {
        rules[numberName] = line

        let name = `${number}. ${line}`
          .replace(/:[a-z]+:/g, '')
          .replace(/<[^\s>]+>/g, '<...>')
          .trim()

        if (name.length > 100) {
          name = name.slice(0, 97).replace(/\S*$/, '') + '...'
        }

        choices.push({
          name,
          value: numberName
        })
      }
    }
  }

  let sourceChannel: MessageableGuildChannel | undefined = undefined
  const messageForRule: Record<string, Message> = Object.create(null)

  return {
    name: 'quote-other-advice',
    roles: 'trusted',
    description: `Quote from 'Other Advice' in the #${CHANNEL_NAME} channel`,
    options: [
      {
        name: 'rule',
        description: 'Rule to quote',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices
      },
      {
        name: 'text',
        description: 'Custom text to show before the quote',
        type: ApplicationCommandOptionType.String
      }
    ],
    action: async (bot, interaction) => {
      const content = interaction.options.getString('text') || undefined
      const numberName = interaction.options.getString('rule', true)

      if (!sourceChannel) {
        const channels = await loadMessageableChannels(bot)

        sourceChannel = channels.find(channel => channel.name === CHANNEL_NAME)
      }

      if (!sourceChannel) {
        return interaction.reply({
          content: `Failed. Channel #${CHANNEL_NAME} not found.`,
          ephemeral: true
        })
      }

      const rule = rules[numberName]

      if (!rule) {
        return interaction.reply({
          content: `Failed. Rule ${numberName} not found`,
          ephemeral: true
        })
      }

      let linkedMessage: Message | undefined = messageForRule[numberName]

      if (!linkedMessage || isDeleted(linkedMessage)) {
        // Ensure we don't accidentally use a deleted message
        linkedMessage = undefined

        // TODO: Should this be coming from api/messages.ts instead?
        const messages = await sourceChannel.messages.fetch({ limit: 100 })

        for (const message of messages.values()) {
          if (message.content.includes(rule)) {
            messageForRule[numberName] = linkedMessage = message
            break
          }
        }
      }

      if (!linkedMessage) {
        return interaction.reply({
          content: `Failed. Message for rule ${numberName} not found in ${CHANNEL_NAME}`,
          ephemeral: true
        })
      }

      const embed = new EmbedBuilder()
        .setDescription(
          `**From [Other advice](${linkedMessage.url}) in <#${sourceChannel.id}>:**\n\n${rule}`
        )
        .setColor('#1971c2')

      await interaction.reply({
        content,
        embeds: [embed],
        allowedMentions: { parse: ['users'] }
      })
    }
  }
})
