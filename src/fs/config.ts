import dotenv from 'dotenv'
import { Config } from '../core/types/config'
import { logger } from '../core/utils'

export function getConfig(): Config | null {
  logger.info('Checking configuration settings...')

  const config = dotenv.config().parsed as unknown as Config

  if (!config) {
    logger.error(
      `.env file not found. Copy .env.example and populate the config values appropriately`
    )
    return null
  }

  const configSettings: (keyof Config)[] = [
    'BOT_TOKEN',
    'SERVER_ID',
    'APPLICATION_ID',
    'LOG_CHANNEL_ID',
    'MODERATOR_ROLES',
    'TRUSTED_ROLES',
    'REPORT_SPAM_CHANNEL_ID',
    'BLOCKED_ROLE'
  ]

  let fail = false

  for (const setting of configSettings) {
    const value = config[setting]

    if (value) {
      logger.log(`  - ${setting} is present in the .env config file`)
    } else {
      fail = true

      logger.error(
        value == null
          ? `  - ${setting} is missing from the .env config file`
          : `  - ${setting} is present in the .env config file but has an empty value`
      )
    }
  }

  if (fail) {
    return null
  }

  return config
}
