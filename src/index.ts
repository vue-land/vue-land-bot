import { fetchLogChannel, fetchReportSpamChannel } from './api/channels'
import { BotBuilder } from './core/bot'
import { logger } from './core/utils'
import checkDiscordInvites from './features/check-discord-invites'
import deletedMessageLog from './features/deleted-message-log'
import instructionMessage from './features/instruction-message'
import jobsChannel from './features/jobs-channel'
import ping from './features/ping'
import quote from './features/quote'
import spamDetection from './features/spam-detection'
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
    .use(checkDiscordInvites)
    .use(deletedMessageLog)
    .use(instructionMessage)
    .use(jobsChannel)
    .use(ping)
    .use(quote)
    .use(spamDetection)
    .use(statistics)
    .use(updateMessage)
    .init()

  await fetchLogChannel(bot)
  await fetchReportSpamChannel(bot)

  logger.info('Ready')
}

init()
