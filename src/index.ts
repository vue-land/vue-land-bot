import { fetchLogChannel } from './api/channels'
import { BotBuilder } from './core/bot'
import { logger } from './core/utils'
import checkDiscordInvites from './features/check-discord-invites'
import deletedMessageLog from './features/deleted-message-log'
import ping from './features/ping'
import statistics from './features/statistics'
import { getConfig } from './fs/config'

const init = async () => {
  logger.info(`Bot started ${new Date().toISOString()}`)

  const config = getConfig()

  if (config == null) {
    logger.error('Aborting due to missing configuration')
    return
  }

  const builder = new BotBuilder(config)

  const bot = await builder
    .use(checkDiscordInvites)
    .use(deletedMessageLog)
    .use(ping)
    .use(statistics)
    .init()

  await fetchLogChannel(bot)

  logger.info('Ready')
}

init()
