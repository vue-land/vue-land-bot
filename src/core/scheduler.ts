import { Awaitable } from 'discord.js'
import { pause, withErrorLogging } from './utils'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const INCREMENTS = {
  daily: MS_PER_DAY,
  weekly: 7 * MS_PER_DAY
}

export default function (
  startTime: number,
  interval: 'weekly' | 'daily',
  callback: () => Awaitable<void>
) {
  let time = startTime

  const increment = INCREMENTS[interval]

  const nextWeeklyTime = async () => {
    const now = Date.now()

    // Keep adding 1 time unit until we find a time in the future
    do {
      time += increment
    } while (time < now)

    return pause(time - now)
  }

  const callbackWithErrorLogging = withErrorLogging('Scheduled task', callback)

  const startTask = async () => {
    while (true) {
      await nextWeeklyTime()
      await callbackWithErrorLogging()
    }
  }

  startTask()
}
