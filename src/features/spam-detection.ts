import { ApplicationCommandOptionType } from 'discord-api-types/v9'
import { Message, MessageEmbedOptions, TextChannel } from 'discord.js'
import {
  fetchLogChannel,
  fetchReportSpamChannel,
  useThread
} from '../api/channels'
import { getTrustedRoles } from '../api/roles'
import { Bot } from '../core/bot'
import { feature } from '../core/feature'
import { logger } from '../core/utils'

const recentMessages: { message: Message; receivedTime: number }[] = []

// These aren't perfect, but they should work well enough for now
const stripCode = (content: string) => content.replace(/`[^`]*`/g, '')
const stripEmoji = (content: string) => content.replace(/:\w+:/g, '')

const containsLink = (content: string) => {
  const withoutCode = stripCode(content)

  return withoutCode.includes('http://') || withoutCode.includes('https://')
}

const containsBannedTag = (content: string) => {
  const withoutCode = stripCode(content)

  return withoutCode.includes('@here') || withoutCode.includes('@everyone')
}

const isDuplicate = (content: string, newMessageContent: string) => {
  return content.toLowerCase().trim() === newMessageContent.toLowerCase().trim()
}

const isCrossPost = (content: string, newMessageContent: string) => {
  // Ignore very short messages and emoji as they probably aren't cross-posts
  return (
    stripEmoji(content).trim().length > 25 &&
    isDuplicate(content, newMessageContent)
  )
}

const anyMessage = () => true

const postLogMessage = async (
  bot: Bot,
  messages: Message[],
  reason: string
) => {
  const logChannel = await fetchLogChannel(bot)

  // Use the last message as the reference point as that's the one that triggered the violation
  const message = messages[messages.length - 1]
  const time = message.createdTimestamp

  const messageList = messages.slice(-10).map(msg => {
    const channel = (msg.channel as TextChannel).name
    const timeDifference = Math.round((time - msg.createdTimestamp) / 1000)
    return `:small_blue_diamond: [In #${channel}, ${timeDifference}s ago](${msg.url})`
  })

  const embed: MessageEmbedOptions = {
    color: '#e03131',
    author: {
      name: message.author.tag,
      icon_url: message.author.displayAvatarURL()
    },
    title: reason,
    description: `
			${messageList.join('\n')}
			-----
			${message.content}
		`,
    timestamp: new Date(),
    footer: {
      text: `User ID: ${message.author.id}`
    }
  }

  const thread = await useThread(logChannel, 'SPAM')

  await thread.send({ embeds: [embed] })
}

const blockFor = (reason: string) => {
  return async (bot: Bot, messages: Message[]) => {
    const firstMessage = messages[0]

    const blockedRole = bot.guild.roles.cache.find(
      role => role.name.toLowerCase() === bot.config.BLOCKED_ROLE.toLowerCase()
    )

    const member = firstMessage.member

    // Appease TS
    if (!member) {
      logger.warn(`User could not be blocked as the message has no member`)
      return
    }

    if (blockedRole) {
      let rolePreventingBlocking = null
      const memberRoles = member.roles.cache

      if (memberRoles.size) {
        const trustedRoles = await getTrustedRoles(bot)
        const unblockableRoleIds = trustedRoles
          .concat(blockedRole)
          .map(({ id }) => id)

        rolePreventingBlocking = memberRoles.find(role =>
          unblockableRoleIds.includes(role.id)
        )
      }

      if (rolePreventingBlocking) {
        logger.info(
          `User ${member.user.tag} was not blocked because they have the ${rolePreventingBlocking.name} role`
        )
      } else {
        await member.roles.add(blockedRole)

        const reportSpamChannel = await fetchReportSpamChannel(bot)

        await reportSpamChannel.send(
          `User <@${member.id}> has been blocked by the spam filter.`
        )
      }
    } else {
      logger.warn(
        `User ${member.user.tag} could not be blocked as the BLOCKED_ROLE does not exist`
      )
    }

    await postLogMessage(bot, messages, 'Blocked for ' + reason)
  }
}

const blockForBannedTags = blockFor('using banned tags')
const blockForExcessiveLinks = blockFor('excessive links')
const blockForExcessiveDuplicates = blockFor('excessive duplicates')
const blockForExcessivePosts = blockFor('excessive posts')

// Longer term this might add a reaction to the messages so that everyone can see they're duplicates
const logCrossPost = async (bot: Bot, messages: Message[]) => {
  await postLogMessage(bot, messages, 'Duplicate posts')
}

const logBannedTags = async (bot: Bot, messages: Message[]) => {
  await postLogMessage(bot, messages, 'Used banned tags')
}

interface Rule {
  isBrokenBy: (content: string, newMessageContent: string) => boolean
  timeframe: number
  channelCount: number
  action: (bot: Bot, messages: Message[]) => Promise<void>
}

// It is tricky to configure these thresholds so that they catch spam but don't catch genuine users who are just
// involved in multiple conversations.
const rules: Rule[] = [
  {
    isBrokenBy: containsBannedTag,
    timeframe: 60,
    channelCount: 3,
    action: blockForBannedTags
  },
  {
    isBrokenBy: containsLink,
    timeframe: 10,
    channelCount: 3,
    action: blockForExcessiveLinks
  },
  {
    isBrokenBy: containsLink,
    timeframe: 30,
    channelCount: 4,
    action: blockForExcessiveLinks
  },
  {
    isBrokenBy: containsLink,
    timeframe: 60,
    channelCount: 5,
    action: blockForExcessiveLinks
  },
  {
    isBrokenBy: isDuplicate,
    timeframe: 10,
    channelCount: 3,
    action: blockForExcessiveDuplicates
  },
  {
    isBrokenBy: isDuplicate,
    timeframe: 60,
    channelCount: 4,
    action: blockForExcessiveDuplicates
  },
  {
    isBrokenBy: anyMessage,
    timeframe: 10,
    channelCount: 4,
    action: blockForExcessivePosts
  },
  {
    isBrokenBy: anyMessage,
    timeframe: 20,
    channelCount: 5,
    action: blockForExcessivePosts
  },
  {
    isBrokenBy: anyMessage,
    timeframe: 60,
    channelCount: 6,
    action: blockForExcessivePosts
  },
  {
    isBrokenBy: anyMessage,
    timeframe: 120,
    channelCount: 7,
    action: blockForExcessivePosts
  },
  {
    isBrokenBy: isCrossPost,
    timeframe: 600,
    channelCount: 2,
    action: logCrossPost
  },
  {
    isBrokenBy: containsBannedTag,
    timeframe: 1, // Irrelevant as any use is logged
    channelCount: 1,
    action: logBannedTags
  }
]

const MAX_RULES_TIMEFRAME = Math.max(...rules.map(({ timeframe }) => timeframe))

function purgeExpired() {
  // Double it to give a margin for error
  const cutOff = Date.now() - MAX_RULES_TIMEFRAME * 2 * 1000

  // Use receivedTime for purging as we have full control over that. We shouldn't get anywhere near 5000 messages, as
  // that's approximately how many messages we get in a week.
  while (
    (recentMessages.length && recentMessages[0].receivedTime < cutOff) ||
    recentMessages.length > 5000
  ) {
    recentMessages.shift()
  }
}

let maxTimeDifference = 0

export default feature({
  commands: [
    {
      name: 'list-blocked',
      description: 'List users blocked for spam violations',
      roles: 'trusted',
      action: async (bot, interaction) => {
        const { guild } = bot

        const blockedRole = guild.roles.cache.find(
          role =>
            role.name.toLowerCase() === bot.config.BLOCKED_ROLE.toLowerCase()
        )

        if (!blockedRole) {
          await interaction.reply({
            content: `A suitable role is not configured`,
            ephemeral: true
          })
          return
        }

        const users = guild.members.cache
          .filter(member => {
            return !!member.roles.cache.find(role => {
              return role.id === blockedRole.id
            })
          })
          .map(({ user }) => user)
          .slice(0, 10)

        const userList = users.map(user => `:small_blue_diamond: <@${user.id}>`)

        await interaction.reply({
          content: `**Users in role ${blockedRole.name}:**\n${userList.join(
            '\n'
          )}\nThis list may be incomplete`,
          ephemeral: true
        })
      }
    },
    {
      name: 'unblock',
      description: 'Unblock a user who triggered the spam filter',
      roles: 'trusted',
      options: [
        {
          name: 'user',
          description: 'User to unblock',
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ],
      action: async (bot, interaction) => {
        const { guild } = bot

        const blockedRole = guild.roles.cache.find(
          role =>
            role.name.toLowerCase() === bot.config.BLOCKED_ROLE.toLowerCase()
        )

        if (!blockedRole) {
          await interaction.reply({
            content: `A suitable role is not configured`,
            ephemeral: true
          })
          return
        }

        const user = interaction.options.getUser('user', true)

        const member = await guild.members.fetch(user.id)

        const hasRole = !!member.roles.cache.find(role => {
          return role.id === blockedRole.id
        })

        if (!hasRole) {
          await interaction.reply({
            content: `<@${user.id}> doesn't appear to have the **${blockedRole.name}** role`,
            ephemeral: true
          })
          return
        }

        await member.roles.remove(blockedRole)

        await interaction.reply({
          content: `<@${user.id}> has been removed from the **${blockedRole.name}** role`,
          ephemeral: true
        })
      }
    }
  ],

  events: {
    async messageCreate(bot, message) {
      if (message.author.bot || !['DEFAULT', 'REPLY'].includes(message.type)) {
        return
      }

      const receivedTime = Date.now()

      // The message object is live, so if it is edited or deleted it will be automatically updated. This is important
      // when we're detecting cross-posts, as we don't want to detect cases where the user tried to move the message to a
      // more suitable channel.
      recentMessages.push({
        message,
        receivedTime
      })

      const timeDifference = Math.abs(message.createdTimestamp - receivedTime)

      // This is intended to be temporary, but it should be useful to understand how big the difference is
      if (timeDifference > maxTimeDifference) {
        maxTimeDifference = timeDifference
        logger.log(
          `Local time differs from Discord time by ${timeDifference}ms`
        )
      }

      const messagesForUser = recentMessages
        .map(({ message }) => message)
        .filter(msg => !msg.deleted && msg.author.id === message.author.id)

      for (const rule of rules) {
        // We pass the same message twice as some rules need to compare messages
        if (rule.isBrokenBy(message.content, message.content)) {
          const startTime = message.createdTimestamp - rule.timeframe * 1000
          const qualifyingMessages = messagesForUser.filter(
            msg =>
              msg.createdTimestamp > startTime &&
              rule.isBrokenBy(msg.content, message.content)
          )
          const channels = new Set(qualifyingMessages.map(msg => msg.channelId))

          if (channels.size >= rule.channelCount) {
            await rule.action(bot, qualifyingMessages)
            break
          }
        }
      }

      purgeExpired()
    }
  }
})
