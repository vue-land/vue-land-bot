import { ApplicationCommandOptionType } from 'discord-api-types/v9'
import { BaseGuildTextChannel, Message } from 'discord.js'
import { loadTextChannels } from '../api/channels'
import { command } from '../core/feature'
import { logger } from '../core/utils'
import { getAsset } from '../fs/assets'

const CHANNEL_NAMES = ['welcome', 'related-discords', 'how-to-get-help']

export default command({
  name: 'update-message',
  roles: 'moderators',
  description: 'Update a welcome message',
  options: [
    {
      name: 'channel',
      description: 'Channel to update',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: CHANNEL_NAMES.map(name => ({ name, value: name }))
    }
  ],
  action: async (bot, interaction) => {
    const channelName = interaction.options.getString('channel', true)

    if (!CHANNEL_NAMES.includes(channelName)) {
      await interaction.reply({
        content: `Unknown channel \`#${channelName}\``,
        ephemeral: true
      })
      logger.error(`update-message: Unknown channel, ${channelName}`)
      return
    }

    await interaction.reply({
      content: `Updating \`#${channelName}\`...`,
      ephemeral: true
    })

    const textChannels = await loadTextChannels(bot)

    const channel = textChannels.find(channel => channel.name === channelName)
    const errorMessage = `\`#${channelName}\` could not be updated`

    if (!channel) {
      logger.error(`update-message: Text channel ${channelName} not found`)
      await interaction.editReply(errorMessage)
      return
    }

    const message = (await updateChannel(channel)) || errorMessage

    if (message) {
      await interaction.editReply(message)
    }
  }
})

async function updateChannel(
  channel: BaseGuildTextChannel
): Promise<string | void> {
  const channelName = channel.name

  const logError = (message: string) => {
    logger.error(`update-message for #${channelName} failed: ${message}`)
  }

  const pageOfMessages = await channel.messages.fetch({ limit: 100 })

  // A basic sanity check before we start trying to delete messages
  if (pageOfMessages.size > 30) {
    logError('Too many messages in the specified channel')
    return
  }

  const messages: Message[] = []
  let authorId = null

  for (const message of pageOfMessages.values()) {
    authorId = authorId || message.author.id

    // Check some more constraints that confirm the channel is in the state we expect
    if (message.author.id !== authorId) {
      logError('The specified channel has messages by multiple authors')
      return
    }

    if (!message.editable) {
      logError(`Message ${message.id} is not editable`)
      return
    }

    if (!message.deletable) {
      logError(`Message ${message.id} is not deletable`)
      return
    }

    messages.push(message)
  }

  const messageText = await getAsset(`${channel.name}.md`)

  // Check that the new message isn't suspiciously short
  if (messageText.length < 300) {
    logError('The new message is too short')
    return
  }

  // Split into multiple posts using --- as a divider. Add a zero-width space to separate the posts
  const newPosts = messageText
    .split('\n---\n')
    .map(text => text.trim() + '\n\u200b')

  // Remove the trailing space from the final message
  const lastIndex = newPosts.length - 1
  newPosts[lastIndex] = newPosts[lastIndex].slice(0, -2)

  // The limit is 2000
  if (newPosts.some(post => post.length > 1950)) {
    logError('The new message is too long')
    return
  }

  let didSomething = false
  let excessMessages = messages.length - newPosts.length

  // If there aren't enough existing messages then we delete them all and start again
  if (excessMessages < 0) {
    excessMessages = messages.length
  }

  // We need the messages in the order they were posted
  messages.reverse()

  // Delete messages, if required. Where possible we just edit the messages instead
  while (excessMessages > 0) {
    const message = messages.pop()
    await message?.delete()
    --excessMessages
    didSomething = true
  }

  // If there are undeleted messages then we edit them, otherwise we need to post all new messages
  if (messages.length) {
    for (const message of messages) {
      const newContent = newPosts.shift() as string

      if (newContent !== message.content) {
        await message.edit(newContent)
        didSomething = true
      }
    }
  } else {
    for (const postContent of newPosts) {
      await channel.send(postContent)
      didSomething = true
    }
  }

  return didSomething
    ? `Updated <#${channel.id}>`
    : `No update required for <#${channel.id}>`
}
