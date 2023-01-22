import { ApplicationCommandOptionType } from 'discord-api-types/v9'
import { EmbedBuilder } from 'discord.js'
import { MessageableGuildChannel } from '../api/types/channels'
import { loadMessageableChannels } from '../api/channels'
import { command } from '../core/feature'
import { getAsset } from '../fs/assets'

const RULES_CHANNEL_NAME = 'rules'
let rulesChannel: MessageableGuildChannel | undefined = undefined

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
  const rulesText = await getAsset(`${RULES_CHANNEL_NAME}.md`)
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

  return {
    name: 'quote-rule',
    roles: 'trusted',
    description: 'Quote a rule from the #rules channel',
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

      if (!rulesChannel) {
        const channels = await loadMessageableChannels(bot)

        rulesChannel = channels.find(
          channel => channel.name === RULES_CHANNEL_NAME
        )
      }

      if (!rulesChannel) {
        return interaction.reply({
          content: `Failed. Channel #${RULES_CHANNEL_NAME} not found.`,
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

      const embed = new EmbedBuilder()
        .setDescription(`**From <#${rulesChannel.id}>:**\n\n${rule}`)
        .setColor('#1971c2')

      await interaction.reply({
        content,
        embeds: [embed],
        allowedMentions: { parse: ['users'] }
      })
    }
  }
})
