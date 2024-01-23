import { loadMessageStatistics, postCountsAsRanking } from '../api/statistics'
import { tasks } from '../core/feature'
import { getFilteringDateString, logger } from '../core/utils'

// This task generates statistics once per week and posts them to the configured channel
export default tasks({
  // This time is 2021-10-10 00:10:00.000 UTC, which is a Sunday
  startTime: 1633824600000,
  interval: 'weekly',

  action: async bot => {
    // Generates statistics from 28 days ago until yesterday. The range is inclusive.
    const range = {
      startDay: -28,
      endDay: -1
    }

    const startDate = getFilteringDateString(range.startDay)
    const endDate = getFilteringDateString(range.endDay)
    const days = range.endDay - range.startDay + 1

    const rangeString = `${startDate} to ${endDate} (${days} days)`

    logger.info(`Starting weekly statistics generation for ${rangeString}...`)

    const { users, channels } = await loadMessageStatistics(bot, range)

    await postCountsAsRanking(
      bot,
      `Posts per channel for ${rangeString}`,
      channels
    )
    await postCountsAsRanking(bot, `Posts per user for ${rangeString}`, users)

    logger.info('Successfully completed weekly statistics generation')
  }
})
