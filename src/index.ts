import { Context, Schema } from 'koishi'
import https from 'https'

export const name = 'mcmotd'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

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

function stripColorCodes(text) {
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

export function apply(ctx: Context) {
  ctx.command('motd <server>', '查询我的世界服务器状态', { authority: 1 })
    .action(async ({ session }, server) => {
      let [host, port] = server.split(':')
      if (!port) {
        port = host.includes('.') ? '19132' : '25565'
      }
      try {
        const data = await getServerStatus(host, port)
        
        // 检查服务器是否在线
        const onlineStatus = data.status === 'online' ? '在线' : '不在线';

        if (onlineStatus === '不在线') {
          session.send('服务器当前不在线。');
          return;
        }

        const translatedKeys = {
          'status': '状态',
          'players': '在线人数',
          'maxPlayers': '最大在线人数',
          'version': '游戏版本',
          'motd': '描述',
          'ping': '延迟',
          'online': '在线人数', // 添加这个键值对以适应API返回的数据结构
          'max': '最大在线人数', // 添加这个键值对以适应API返回的数据结构
          'level_name': '地图名称',
          'gamemode': '默认模式'
        }

        // 删除motd中的颜色代码
        const motdWithoutColors = stripColorCodes(data.motd)

        // 格式化输出信息，只在服务器在线时展示详细信息
        const lines = Object.entries(data).filter(([key]) => key !== 'status').map(([key, value]) => {
          if (key === 'motd') return `${translatedKeys[key]}: ${motdWithoutColors}`;
          return `${translatedKeys[key] || key}: ${value}`;
        })

        const formattedLines = lines.map(line => `${line}`)
        const formattedOutput = `
状态: ${onlineStatus}
地址: ${host}:${port}
描述: ${motdWithoutColors}
延迟: ${data.delay} ms
协议版本: ${data.agreement}
游戏版本: ${data.version}
在线人数: ${data.online}/${data.max}
地图名称: ${data.level_name}
默认模式: ${data.gamemode}
`
        session.send(formattedOutput.trim())
      } catch (error) {
        session.send('无法获取服务器状态信息。')
      }
    })
}

//群服motd绑定
interface GroupServerBinding {
  groupId: number
  server: string // 格式如 "ip:port"
}

interface Config {
  bindings: GroupServerBinding[]
}

export const name = 'mcbind'
export const Config: Schema<Config> = Schema.object({
  bindings: Schema.array(GroupServerBinding).default([])
})

export function apply(ctx: Context) {
  ctx.command('mcbind <server>', '绑定我的世界服务器到当前群组', { authority: 3 })
    .userFields(['groupId'])
    .action(async ({ session }) => {
      if (session.user.authority >= 3 || session.channel.ownerId === session.userId) {
        const [ip, port] = session.argv[0].split(':')
        if (!port) {
          session.send('请正确输入服务器地址和端口，格式：/mcbind ip:端口')
          return
        }

        ctx.config.mcbind.bindings.push({ groupId: session.channelId, server: `${ip}:${port}` })
        ctx.save()

        session.send('成功绑定我的世界服务器到本群！')
      } else {
        session.send('您没有足够的权限进行服务器绑定操作。')
      }
    })

  ctx.command('mcquery', '查询当前群组绑定的服务器信息')
    .userFields(['groupId'])
    .action(async ({ session }) => {
      const binding = ctx.config.mcbind.bindings.find(b => b.groupId === session.channelId)
      if (binding) {
        session.send(`该群绑定的我的世界服务器地址是：${binding.server}`)
      } else {
        session.send('该群还没有绑定我的世界游戏服务器。')
      }
    })

  // 假设已有的motd查询逻辑不变，增加一个判断是否为已绑定群的条件
  ctx.command('online', '查询服务器在线状态')
    .userFields(['groupId'])
    .action(async ({ session }) => {
      const binding = ctx.config.mcbind.bindings.find(b => b.groupId === session.channelId)
      if (binding) {
        try {
          const [host, port] = binding.server.split(':')
          const data = await getServerStatus(host, port)

          // ...（这里继续使用之前motd查询的逻辑）...

        } catch (error) {
          session.send('无法获取服务器状态信息。')
        }
      } else {
        session.send('该群还没有绑定我的世界游戏服务器。')
      }
    })
}