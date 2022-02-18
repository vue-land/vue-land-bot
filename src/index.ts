import { fetchLogChannel } from './api/channels'
import { BotBuilder } from './core/bot'
import { logger } from './core/utils'
import deletedMessageLog from './features/deleted-message-log'
import ping from './features/ping'
import statistics from './features/statistics'
import updateMessage from './features/update-message'
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
    .use(deletedMessageLog)
    .use(ping)
    .use(statistics)
    .use(updateMessage)
    .init()

  await fetchLogChannel(bot)

  logger.info('Ready')
}

init()
