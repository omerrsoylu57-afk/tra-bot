const http = require('http');
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  AuditLogEvent,
  PermissionFlagsBits
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildModeration
  ]
});

const TOKEN = 'MTU3MzQ3Mjg1MjIyMzQ2MzU2Ng.GqsS0_.7gY2aI-E-k0x1J6P1axThbcYWKK5uee4ekw3vM';
const CLIENT_ID = '1573472852223463566';
const GUILD_ID = '1570835193474842727';
const LOG_CHANNEL_ID = '1570835199472701508';
const ALLOWED_USER_IDS = ['1538803759004516433'];

const commands = [
  new SlashCommandBuilder()
    .setName('durum')
    .setDescription('Botun aktiflik durumunu gösterir'),
  new SlashCommandBuilder()
    .setName('duyuru')
    .setDescription('Yetkili duyuru mesajı gönderir')
    .addStringOption((option) =>
      option
        .setName('mesaj')
        .setDescription('Gönderilecek metin')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('denetim')
    .setDescription('Son denetim kayıtlarını kontrol edip sana DM gönderir')
].map((cmd) => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands
  });
}

async function sendLog(guild, title, description) {
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel || !logChannel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

function formatAuditEntry(entry) {
  const executor = entry.executor ? `<@${entry.executor.id}> (\`${entry.executor.tag}\`)` : 'Bilinmiyor';
  const target = entry.target ? ('tag' in entry.target ? `<@${entry.target.id}>` : `\`${entry.target.name || entry.target.id}\``) : 'Yok';

  if (entry.action === AuditLogEvent.MemberRoleUpdate) {
    const changes = (entry.changes || []).map((c) => {
      const roles = (c.new || c.old || []).map((r) => `<@&${r.id}>`).join(', ') || 'Rol';
      if (c.key === '$add') return `**Verilen rol:** ${roles} -> ${target}`;
      if (c.key === '$remove') return `**Alınan rol:** ${roles} <- ${target}`;
      return `${c.key} değişti (${target})`;
    });
    return `• ${executor} | ${changes.join(' | ') || 'Rol güncellendi'}`;
  }

  return `• ${executor} | İşlem: \`${AuditLogEvent[entry.action] || entry.action}\` | Hedef: ${target}`;
}

client.once('ready', async () => {
  await registerCommands();
  console.log(`${client.user.tag} aktif.`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  if (interaction.commandName === 'durum') {
    await interaction.reply({ content: 'Sistem aktif ve çalışıyor.' });
    await sendLog(
      interaction.guild,
      'Açık Komut Kullanıldı',
      `**Komut:** \`/durum\`\n**Kullanıcı:** <@${interaction.user.id}> (\`${interaction.user.id}\`)\n**Kanal:** <#${interaction.channel.id}>`
    );
    return;
  }

  if (interaction.commandName === 'duyuru') {
    if (!ALLOWED_USER_IDS.includes(interaction.user.id)) {
      await interaction.reply({
        content: 'Bu komutu kullanma yetkin yok.',
        ephemeral: true
      });
      return;
    }

    const text = interaction.options.getString('mesaj', true);
    await interaction.reply({
      content: 'Duyuru gönderildi.',
      ephemeral: true
    });
    await interaction.channel.send(text);

    await sendLog(
      interaction.guild,
      'Yetkili Slash Komutu Kullanıldı',
      `**Komut:** \`/duyuru\`\n**Yetkili:** <@${interaction.user.id}> (\`${interaction.user.id}\`)\n**Kanal:** <#${interaction.channel.id}>\n**İçerik:** ${text}`
    );
    return;
  }

  if (interaction.commandName === 'denetim') {
    if (!ALLOWED_USER_IDS.includes(interaction.user.id)) {
      await interaction.reply({
        content: 'Bu komutu kullanma yetkin yok.',
        ephemeral: true
      });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      await interaction.reply({
        content: 'Botta **Denetim Kaydını Görüntüle (View Audit Log)** yetkisi yok.',
        ephemeral: true
      });
      return;
    }

    const logs = await interaction.guild.fetchAuditLogs({ limit: 10 });
    const lines = logs.entries.map(formatAuditEntry);

    const dmEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`Denetim Raporu - ${interaction.guild.name}`)
      .setDescription(lines.length ? lines.join('\n') : 'Kayıt bulunamadı.')
      .setTimestamp();

    try {
      await interaction.user.send({ embeds: [dmEmbed] });
      await interaction.reply({
        content: 'Denetim kayıtları DM kutuna gönderildi.',
        ephemeral: true
      });
    } catch {
      await interaction.reply({
        content: 'Sana DM atamadım. Gizlilik ayarlarından sunucu üyelerinden gelen DM mesajlarını aç.',
        ephemeral: true
      });
    }

    await sendLog(
      interaction.guild,
      'Denetim Komutu Çalıştırıldı',
      `**Komut:** \`/denetim\`\n**Yetkili:** <@${interaction.user.id}> (\`${interaction.user.id}\`)`
    );
  }
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Bot aktif');
}).listen(PORT);

client.login(TOKEN);
                
