import { Message, PartialMessage, ThreadChannel } from 'discord.js'
import { BotContext } from '../core/bot'

export type Deletable = Message | PartialMessage | ThreadChannel

const deleted = new WeakSet<Deletable>()

export function register(bot: BotContext) {
  bot.addEvent('messageDelete', (_, message) => {
    deleted.add(message)
  })

  bot.addEvent('threadDelete', (_, thread) => {
    deleted.add(thread)
  })
}

export function isDeleted(entity: Deletable) {
  if ('channel' in entity) {
    const channel = entity.channel

    // If the channel is missing then it typically means that the message is from a deleted thread. We check the thread
    // explicitly, but in practice it shouldn't be present on the message anyway.
    if (!channel || (channel.isThread() && deleted.has(channel))) {
      return true
    }
  }

  return deleted.has(entity)
}
