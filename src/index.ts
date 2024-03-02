import { Context, Schema } from 'koishi'

export const name = 'rw-ip'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})
1111
export function apply(ctx: Context) {
  // write your plugin here
}
