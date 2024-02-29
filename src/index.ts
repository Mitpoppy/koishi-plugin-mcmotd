import { Context, Schema } from 'koishi'
import https from 'https'

export const name = 'mcmotd'

export const usage = `
# <center>MC MOTD</center>

# <center>🦀菜就多恋，谈不起就别谈🦀</center>

# <center>开箱即用，无需配置，右上角立即启用插件😋</center>

### 指令用法
- motd
参数：** ip:端口 **
示列：
** motd mc.someo.top **
** motd mc.someo.top:19132 **
** motd mc.someo.top:25565 **
tip：不填端口默认基岩版是19132，JAVA版是25565
- 介绍
作者：狗子（或幻想）
一个碌碌无为的开发者，什么你问我上面为什么写不用配置，因为我懒b一个，缓慢更新中，有BUG反馈或催更请加QQ群：1094060150
或者也可以在github上面发issue有生之年看见可能会修一下罢|ω・）
`

export interface Config {}

export const Config: Schema = Schema.object({})

interface ServerStatusData {
  favicon: any;
  players: any;
  port: any;
  players_max: any;
  players_online: any;
  status: string;
  host: string;
  motd: string;
  agreement: number;
  version: string;
  online: number;
  max: number;
  level_name: string;
  gamemode: string;
  delay: number;
}

function getServerStatus(host: string, port: string, url: string) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
}

function stripColorCodes(text: string) {
  return text.replace(/§\w|\u00A7\w/g, '')
}

function parseServerInput(serverInput: string): { host: string, port: string } {
  let [host, port] = serverInput.split(':')
  if (!port) {
    port = host.includes('.') ? '19132' : '25565'
  }
  return { host, port }
}

export function apply(ctx: Context) {
  ctx.command('motd <server>', '查询我的世界服务器状态', { authority: 1 })
    .action(async ({ session }, server) => {
      const { host, port } = parseServerInput(server)
      const url1 = `https://motdbe.blackbe.work/api?host=${host}:${port}`
      const url2 = `https://api.imlazy.ink/mcapi/?host=${host}&port=${port}&type=json`

      try {
        const data1 = await getServerStatus(host, port, url1) as ServerStatusData
        if (data1.status === 'online') {
          const motdWithoutColors = stripColorCodes(data1.motd)
          const formattedOutput1 = `
状态: 在线
地址: ${data1.host}
描述: ${motdWithoutColors}
延迟: ${data1.delay} ms
协议版本: ${data1.agreement}
游戏版本: ${data1.version}
在线人数: ${data1.online}/${data1.max}
地图名称: ${data1.level_name}
默认模式: ${data1.gamemode}
`
          session.send(formattedOutput1.trim())
        } else {
          const data2 = await getServerStatus(host, port, url2) as ServerStatusData
          if (data2.status === '在线') {
            const formattedOutput2 = `
状态: 在线
地址: ${data2.host}:${data2.port}
描述: ${data2.motd}
版本: ${data2.version}
玩家在线: ${data2.players_online}/${data2.players_max}
玩家列表：${data2.players}（部分服务器无法获取到）
`
            session.send(formattedOutput2.trim())
          } else {
            session.send('无法获取服务器状态信息。')
          }
        }
      } catch (error) {
        session.send('无法获取服务器状态信息。')
      }
    })
}