import { REST } from '@discordjs/rest'
import { APIApplicationCommand, Routes } from 'discord-api-types/v9'
import {
  ApplicationCommandPermissionData,
  Collection,
  CommandInteraction,
  Interaction,
  Role
} from 'discord.js'
import { getModeratorRoles, getTrustedRoles } from '../api/roles'
import { Command } from './types/command'
import { Bot } from './bot'
import { logger } from './utils'

const handleErrorResponse = async (interaction: CommandInteraction) => {
  if (interaction.replied) {
    return
  }

  try {
    await interaction.reply({
      content: 'An error occurred while trying to execute this command!',
      ephemeral: true
    })
  } catch (error) {
    logger.error(error)
  }
}

export default class CommandManager {
  private commands = new Collection<string, Command>()
  private saved = false

  add(command: Command) {
    if (this.saved) {
      throw new Error('New commands cannot be added after the initial save')
    }

    if (command.hidden) {
      return
    }

    const { name } = command

    if (this.get(name)) {
      logger.warn(`Command ${name} is already registered`)
    }

    this.commands.set(name, command)
  }

  private get(name: string) {
    return this.commands.get(name)
  }

  private async run(bot: Bot, interaction: Interaction) {
    const startTime = Date.now()

    if (!interaction.isCommand()) {
      return
    }

    const { commandName, user } = interaction

    const command = this.get(commandName)

    if (!command) {
      logger.error(`Command ${commandName} could not be found!`)
      return handleErrorResponse(interaction)
    }

    try {
      await command.action(bot, interaction)
    } catch (error) {
      logger.error(error)
      return handleErrorResponse(interaction)
    } finally {
      const time = Math.round(Date.now() - startTime)
      logger.log(`Command ${commandName} by ${user.tag} completed in ${time}ms`)
    }
  }

  async save(bot: Bot) {
    logger.info('Registering commands...')

    if (this.saved) {
      throw new Error('Commands can only be saved once')
    }

    this.saved = true

    const commands = await this.saveCommands(bot)

    await this.savePermissions(bot, commands)

    bot.client.on('interactionCreate', async (interaction: Interaction) => {
      await this.run(bot, interaction)
    })

    logger.info('Successfully registered all application commands')
  }

  private async saveCommands({ client, config }: Bot) {
    const api = new REST({ version: '9' }).setToken(client.token)

    const body = this.commands.mapValues(command => {
      const { name, description, options, roles } = command

      return {
        name,
        description,
        options,
        default_permission: roles === 'everyone'
      }
    })

    // Initially commands are created without role-based permissions. Only 'everyone' commands will be available
    // until permissions are updated.
    return (await api.put(
      Routes.applicationGuildCommands(config.APPLICATION_ID, config.SERVER_ID),
      { body }
    )) as APIApplicationCommand[]
  }

  private async savePermissions(bot: Bot, commands: APIApplicationCommand[]) {
    const moderatorRoles = await getModeratorRoles(bot)
    const trustedRoles = await getTrustedRoles(bot)

    const mapRoles = (roles: Role[]) => {
      const permissions: ApplicationCommandPermissionData[] = roles.map(
        ({ id }) => ({
          id,
          type: 'ROLE',
          permission: true
        })
      )

      const roleNames = roles.map(role => role.name).join(', ')

      return { permissions, roleNames }
    }

    const roleToPermissions = {
      moderators: mapRoles(moderatorRoles),
      trusted: mapRoles(trustedRoles)
    }

    const fullPermissions = []

    for (const { id, name } of commands) {
      const command = this.get(name)

      if (!command) {
        throw new Error(`Assertion failure: ${name} command is missing`)
      }

      if (command.roles === 'everyone') {
        logger.log(`  /${command.name} - everyone`)
      } else {
        const { permissions, roleNames } = roleToPermissions[command.roles]

        fullPermissions.push({
          id,
          permissions
        })

        logger.log(`  /${command.name} - ${roleNames}`)
      }
    }

    // Save all permissions in one go, otherwise performance suffers
    await bot.guild.commands.permissions.set({ fullPermissions })
  }
}
