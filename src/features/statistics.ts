import { loadMessageStatistics, postCountsAsRanking } from '../api/statistics'
import { tasks } from '../core/feature'
import { logger } from '../core/utils'

// This task generates statistics once per week and posts them to the configured channel
export default tasks({
  // This time is 2021-10-10 00:10:00.000 UTC, which is a Sunday
  startTime: 1633824600000,
  interval: 'weekly',

  action: async bot => {
    logger.info('Starting weekly statistics generation...')

    // Generates statistics from 28 days ago until yesterday. The range is inclusive.
    const DAYS = 28

    const { users, channels } = await loadMessageStatistics(bot, {
      startDay: -DAYS,
      endDay: -1
    })

    await postCountsAsRanking(
      bot,
      `Posts per channel for the last ${DAYS} days`,
      channels
    )
    await postCountsAsRanking(
      bot,
      `Posts per user for the last ${DAYS} days`,
      users
    )

    logger.info('Successfully completed weekly statistics generation')
  }
})
