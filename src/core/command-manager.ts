import { REST } from '@discordjs/rest'
import { APIApplicationCommand, Routes } from 'discord-api-types/v9'
import {
  Collection,
  CommandInteraction,
  Interaction,
  Permissions,
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

    await this.checkPermissions(bot, commands)

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

        // The permissions model doesn't allow us to specify which roles can use a particular command, but we can
        // specify which general permissions a user must have to be able to use it.
        default_member_permissions: String(
          Permissions.FLAGS[
            // There doesn't seem to be a suitable flag for detecting MVPs, so we treat 'trusted' commands the same as
            // 'moderators' and rely on the permissions checks to flag any manual corrections that are needed.
            roles === 'everyone' ? 'SEND_MESSAGES' : 'BAN_MEMBERS'
          ]
        ),

        // This is part of the old permissions model and is now deprecated
        default_permission: false
      }
    })

    // Initially commands are created without role-based permissions. Only 'everyone' commands will be available
    // until permissions are updated.
    return (await api.put(
      Routes.applicationGuildCommands(config.APPLICATION_ID, config.SERVER_ID),
      { body }
    )) as APIApplicationCommand[]
  }

  private async checkPermissions(bot: Bot, commands: APIApplicationCommand[]) {
    // These are command permissions set by the guild admins, overriding the defaults set by the bot
    const permissionOverrides = await bot.guild.commands.permissions.fetch({})

    const allRoles = [...(await bot.guild.roles.fetch()).values()]

    const roleMap = {
      everyone: allRoles,
      moderators: await getModeratorRoles(bot),
      trusted: await getTrustedRoles(bot)
    }

    for (const { default_member_permissions, id, name } of commands) {
      const command = this.get(name)

      if (!command) {
        throw new Error(`Assertion failure: ${name} command is missing`)
      }

      const expectedRolesForCommand = roleMap[command.roles]

      const defaultMemberPermissions = BigInt(default_member_permissions || 0)

      const actualRolesForCommand = allRoles.filter(role => {
        const overrides = permissionOverrides.get(id)

        if (overrides) {
          for (const override of overrides) {
            if (override.type === 'ROLE' && override.id === role.id) {
              return override.permission
            }
          }
        }

        return (
          (role.permissions.bitfield & defaultMemberPermissions) ===
          defaultMemberPermissions
        )
      })

      const toRoleNamesString = (roles: Role[]) => {
        const roleNames = roles.map(role => role.name)

        if (roleNames.includes('@everyone')) {
          return 'everyone'
        }

        return roleNames.sort().join(', ')
      }

      const expectedRoleNames = toRoleNamesString(expectedRolesForCommand)
      const actualRoleNames = toRoleNamesString(actualRolesForCommand)

      if (expectedRoleNames === actualRoleNames) {
        logger.log(`  /${command.name} - ${expectedRoleNames}`)
      } else {
        logger.warn(
          `  /${command.name} - actual: ${actualRoleNames}, expected: ${expectedRoleNames}`
        )
      }
    }
  }
}
