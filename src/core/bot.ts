import { Awaitable, Client, ClientEvents, Guild, Intents } from 'discord.js'
import { register } from '../api/deletion-cache'
import { Command } from './types/command'
import { Config } from './types/config'
import CommandManager from './command-manager'
import schedule from './scheduler'
import { logger, withErrorLogging } from './utils'

export interface Bot {
  client: Client<true>
  config: Config
  guild: Guild
}

export interface BotContext {
  addCommand: (command: Command) => void
  addEvent: <K extends keyof ClientEvents>(
    event: K,
    listener: (bot: Bot, ...args: ClientEvents[K]) => Awaitable<void>
  ) => void
  addScheduledTask: (
    startTime: number,
    interval: 'weekly' | 'daily',
    callback: (bot: Bot) => Awaitable<void>
  ) => void
  bot: Bot
  use: (feature: Feature) => this
}

export interface Feature {
  install: (bot: BotContext) => Awaitable<void>
}

export class BotBuilder {
  private config: Config

  private commands: CommandManager = new CommandManager()
  private features: Feature[] = []

  constructor(config: Config) {
    this.config = config
  }

  addCommand(command: Command) {
    this.commands.add(command)

    return this
  }

  addEvent<K extends keyof ClientEvents>(
    event: K,
    listener: (bot: Bot, ...args: ClientEvents[K]) => Awaitable<void>
  ) {
    return this.use({
      install({ bot }) {
        const listenerWithErrorLogging = withErrorLogging(
          `${event} event listener`,
          listener
        )

        bot.client.on(event, async (...args) =>
          listenerWithErrorLogging(bot, ...args)
        )
      }
    })
  }

  addScheduledTask(
    startTime: number,
    interval: 'weekly' | 'daily',
    callback: (bot: Bot) => Awaitable<void>
  ) {
    return this.use({
      install({ bot }) {
        schedule(startTime, interval, async () => {
          await callback(bot)
        })
      }
    })
  }

  use(feature: Feature) {
    this.features.push(feature)

    return this
  }

  async init() {
    const client = new Client({
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],

      // This prevents @ mentions from pinging by default. Individual features can re-enable them if required.
      allowedMentions: {
        repliedUser: false
      }
    })

    await client.login(this.config.BOT_TOKEN)

    const { config } = this

    const guild = await client.guilds.fetch(config.SERVER_ID)

    logger.info('Logged in')

    const bot: Bot = {
      client,
      config,
      guild
    }

    const context: BotContext = {
      addCommand: this.addCommand.bind(this),
      addEvent: this.addEvent.bind(this),
      addScheduledTask: this.addScheduledTask.bind(this),
      use: feature => {
        this.use(feature)
        return context
      },
      bot
    }

    register(context)

    let feature = null

    while ((feature = this.features.shift())) {
      await feature.install(context)
    }

    await this.commands.save(bot)

    return bot
  }
}
