import { Context, Schema } from 'koishi'
import https from 'https'

export const name = 'mcmotd'

export interface Config {}

export const Config: Schema = Schema.object({})

interface ServerStatusData {
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

export function apply(ctx: Context) {
  ctx.command('motd <server>', '查询我的世界服务器状态', { authority: 1 })
    .action(async ({ session }, server) => {
      let [host, port] = server.split(':')
      if (!port) {
        port = host.includes('.') ? '19132' : '25565'
      }
      try {
        const data = await getServerStatus(host, port) as ServerStatusData
        const translatedKeys = {
          'status': data.status === 'online' ? '在线' : '不在线',
          'host': '地址',
          'motd': '描述',
          'agreement': '协议版本',
          'version': '游戏版本',
          'online': '在线人数',
          'max': '最大在线人数',
          'level_name': '地图名称',
          'gamemode': '默认模式',
          'delay': '延迟'
        }

        // 删除motd中的颜色代码
        const motdWithoutColors = stripColorCodes(data.motd)

        // 检查服务器是否在线
        if (data.status !== 'online') {
          session.send('当前服务器并不在线。')
          return
        }

        // 格式化输出信息
        const lines = Object.entries(data).map(([key, value]) => {
          if (key === 'motd') return `${translatedKeys[key]}: ${motdWithoutColors}`;
          return `${translatedKeys[key] || key}: ${value}`;
        })

        const formattedLines = lines.map(line => `${line}`)
        const formattedOutput = `
状态: ${translatedKeys['status']}
地址: ${data.host}
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
