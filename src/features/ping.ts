import { command } from '../core/feature'

export default command({
  name: 'ping',
  roles: 'everyone',
  description: 'Check the bot is running',

  action: async (bot, interaction) => {
    await interaction.reply({
      content: 'Pong! The bot is running.',
      ephemeral: true
    })
  }
})
