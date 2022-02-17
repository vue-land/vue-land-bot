import { Awaitable, ClientEvents } from 'discord.js'
import { Command } from './types/command'
import { Bot, BotContext } from './bot'
import { toArray } from './utils'

type Events = {
  [K in keyof ClientEvents]?: (
    bot: Bot,
    ...args: ClientEvents[K]
  ) => Awaitable<void>
}

type Task = {
  startTime: number
  interval: 'daily' | 'weekly'
  action: (bot: Bot) => Awaitable<void>
}

interface Config {
  commands?: Command | Command[]
  events?: Events
  tasks?: Task | Task[]
}

export function feature(config: Config) {
  return {
    install(bot: BotContext) {
      if (config.commands) {
        for (const command of toArray(config.commands)) {
          bot.addCommand(command)
        }
      }

      if (config.events) {
        let eventName: keyof ClientEvents

        for (eventName in config.events) {
          const handler = config.events[eventName] as (
            bot: Bot,
            ...args: ClientEvents[typeof eventName]
          ) => Awaitable<void>

          bot.addEvent(eventName, handler)
        }
      }

      if (config.tasks) {
        for (const task of toArray(config.tasks)) {
          bot.addScheduledTask(task.startTime, task.interval, task.action)
        }
      }
    }
  }
}

export function command(commands: Command | Command[]) {
  return feature({ commands })
}

export function events(events: Events) {
  return feature({ events })
}

export function tasks(tasks: Task | Task[]) {
  return feature({ tasks })
}
