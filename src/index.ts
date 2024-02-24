import { Context, Schema } from 'koishi'
import https from 'https'

interface GroupServerBinding {
  groupId: number
  server: string // 格式如 "ip:port"
}

interface MCMOTDConfig {
  bindings: GroupServerBinding[]
}

export const name = 'mcmotd'
export const Config: Schema<MCMOTDConfig> = Schema.object({
  bindings: Schema.array(GroupServerBinding).default([])
})

function getServerStatus(host: string, port: string) {
  return new Promise((resolve, reject) => {
    const url = `https://motdbe.blackbe.work/api?host=${host}:${port}`
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve(JSON.parse(data))
      })
    }).on('error', (err) => {
      const javaUrl = `https://motdbe.blackbe.work/api/java?host=${host}:${port}`
      https.get(javaUrl, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve(JSON.parse(data))
        })
      }).on('error', (err) => {
        reject(err)
      })
    })
  })
}

function stripColorCodes(text: string) {
  return text.replace(/§\w|\u00A7\w/g, '')
}

interface ServerStatusData {
  status: string;
  players: number;
  maxPlayers?: number;
  version?: string;
  motd?: string;
  ping?: number;
  agreement?: number;
  online?: number;
  max?: number;
  level_name?: string;
  gamemode?: string;
}

const translatedKeys = {
  'status': '状态',
  'players': '在线人数',
  'maxPlayers': '最大在线人数',
  'version': '游戏版本',
  'motd': '描述',
  'ping': '延迟',
  'online': '当前在线人数',
  'max': '最大支持人数',
  'level_name': '地图名称',
  'gamemode': '默认模式'
}

export function apply(ctx: Context) {
  ctx.command('motd <server>', '查询我的世界服务器状态', { authority: 1 })
    .action(async ({ session }, server) => {
      let [host, port] = server.split(':')
      if (!port) {
        port = host.includes('.') ? '19132' : '25565'
      }
      
      try {
        const data = await getServerStatus(host, port)

        // 使用之前motd查询的逻辑
        const onlineStatus = data.status === 'online' ? '在线' : '不在线';
        const motdWithoutColors = stripColorCodes(data.motd);
        const formattedOutput = `
          状态: ${onlineStatus}
          地址: ${host}:${port}
          描述: ${motdWithoutColors}
          延迟: ${data.ping} ms
          协议版本: ${data.agreement}
          游戏版本: ${data.version}
          在线人数: ${data.players}/${data.maxPlayers || data.online}
          地图名称: ${data.level_name}
          默认模式: ${data.gamemode}
        `;
        session.send(formattedOutput.trim());
      } catch (error) {
        session.send('无法获取服务器状态信息。')
      }
    })

  ctx.command('mcbind <server>', '绑定我的世界服务器到当前群组', { authority: 3 })
    .userFields(['groupId'])
    .action(async ({ session }, server) => {
      if (session.user.authority >= 3 || session.channel.ownerId === session.userId) {
        const [ip, port] = server.split(':')
        if (!port) {
          session.send('请正确输入服务器地址和端口，格式：/mcbind ip:端口')
          return
        }

        ctx.config.mcmotd.bindings.push({ groupId: session.channelId, server: `${ip}:${port}` })
        ctx.save()

        session.send('成功绑定我的世界服务器到本群！')
      } else {
        session.send('您没有足够的权限进行服务器绑定操作。')
      }
    })

  ctx.command('mcquery', '查询当前群组绑定的服务器信息')
    .userFields(['groupId'])
    .action(async ({ session }) => {
      const binding = ctx.config.mcmotd.bindings.find(b => b.groupId === session.channelId)
      if (binding) {
        session.send(`该群绑定的我的世界服务器地址是：${binding.server}`)
      } else {
        session.send('该群还没有绑定我的世界游戏服务器。')
      }
    })

  ctx.command('online', '查询服务器在线状态')
    .userFields(['groupId'])
    .action(async ({ session }) => {
      const binding = ctx.config.mcmotd.bindings.find(b => b.groupId === session.channelId)
      if (binding) {
        try {
          const [host, port] = binding.server.split(':')
          const data = await getServerStatus(host, port)

          // 使用之前motd查询的逻辑
          const onlineStatus = data.status === 'online' ? '在线' : '不在线';
          const motdWithoutColors = stripColorCodes(data.motd);
          const formattedOutput = `
            状态: ${onlineStatus}
            地址: ${host}:${port}
            描述: ${motdWithoutColors}
            延迟: ${data.ping} ms
            协议版本: ${data.agreement}
            游戏版本: ${data.version}
            在线人数: ${data.players}/${data.maxPlayers || data.online}
            地图名称: ${data.level_name}
            默认模式: ${data.gamemode}
          `;
          session.send(formattedOutput.trim());
        } catch (error) {
          session.send('无法获取服务器状态信息。')
        }
      } else {
        session.send('该群还没有绑定我的世界游戏服务器。')
      }
    })
}