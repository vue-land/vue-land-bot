import { ApplicationCommandOptionType } from 'discord-api-types/v9'
import { fetchLogChannel, loadTextChannels, useThread } from '../api/channels'
import { checkInvitesInChannel } from '../api/invites'
import { feature } from '../core/feature'
import { logger } from '../core/utils'

const CHANNEL_NAME = 'related-discords'

// This task generates statistics once per week and posts them to the configured channel
export default feature({
  commands: {
    name: 'check-discord-invites',
    description: 'Check recent Discord invites posted in a channel',
    roles: 'trusted',
    hidden: true,
    options: [
      {
        name: 'channel',
        description: 'Defaults to related-discords',
        type: ApplicationCommandOptionType.Channel
      }
    ],
    action: async (bot, interaction) => {
      const channelOption = interaction.options.getChannel('channel')

      const channelName = channelOption ? channelOption.name : CHANNEL_NAME

      const textChannels = await loadTextChannels(bot)

      const channel = textChannels.find(channel => channel.name === channelName)

      if (!channel) {
        await interaction.reply({
          content: `Text channel ${channelName} not found`,
          ephemeral: true
        })
        return
      }

      await interaction.reply({
        content: `Checking invites in \`#${channelName}\`...`,
        ephemeral: true
      })

      const { success, failure } = await checkInvitesInChannel(channel)

      success.sort((a, b) => b.invite.presenceCount - a.invite.presenceCount)

      let message = ''

      if (failure.length) {
        message += `**${failure.length} invites are invalid**\n`
        message += failure
          .map(invite => `:small_orange_diamond: ${invite.url}\n`)
          .join('')
      }

      if (success.length) {
        message += `**${success.length} invites are valid**\n`
        message += success
          .map(
            ({ invite, url }) =>
              `◈ ${invite.presenceCount} / ${invite.memberCount} - ${url} - #${invite.channel.name} - ${invite.guild?.name}\n`
          )
          .join('')
      }

      if (!message) {
        message += `No invites found in <#${channel.id}>`
      }

      const messages = []

      while (message) {
        const chunkSize = 1950
        const chunk =
          message.length < chunkSize
            ? message
            : message
                .slice(0, chunkSize)
                .split('\n')
                .slice(0, -1)
                .join('\n')
                .trim()
        messages.push(chunk)
        message = message.slice(chunk.length).trim()
      }

      // Embeds are capped at 6000 characters
      messages.length = Math.min(3, messages.length)

      await interaction.editReply({
        content: `Discord invites in <#${channel.id}>:`,
        embeds: messages.map(description => ({
          description
        }))
      })
    }
  },

  tasks: {
    // This time is 2021-10-10 06:00:00.000 UTC
    startTime: 1633845600000,
    interval: 'daily',
    action: async bot => {
      logger.info('Starting Discord invites check...')

      const textChannels = await loadTextChannels(bot)

      const channel = textChannels.find(
        channel => channel.name === CHANNEL_NAME
      )

      if (!channel) {
        logger.error(`Text channel ${CHANNEL_NAME} not found`)
        return
      }

      const { success, failure } = await checkInvitesInChannel(channel)

      if (failure.length) {
        const logChannel = await fetchLogChannel(bot)

        const thread = await useThread(logChannel, 'MAINTENANCE')

        // TODO: paginate
        const description = failure
          .map(({ line }) => `:small_orange_diamond: ${line}`)
          .join('\n')

        await thread.send({
          embeds: [
            {
              title: 'Expired invites',
              description
            }
          ]
        })
      }

      logger.info(
        `Successfully completed invites check. ${success.length} succeeded, ${failure.length} failed.`
      )
    }
  }
})
