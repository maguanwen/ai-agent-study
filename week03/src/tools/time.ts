import { z } from "zod";
import { defineTool } from "./types.js";

export const timeInputSchema = z.object({
  timezone: z.string().trim().min(1).refine((timezone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }, "请输入有效时区，例如 Asia/Shanghai"),
}).strict();

// 注入时钟，让测试不依赖运行测试时的真实时间。
export function createTimeTool(now: () => Date = () => new Date()) {
  return defineTool({
    name: "get_current_time",
    description: "查询指定时区的当前时间，例如 Asia/Shanghai。",
    inputSchema: timeInputSchema,
    execute({ timezone }) {
      const date = now();
      return {
        timezone,
        utc: date.toISOString(),
        localTime: new Intl.DateTimeFormat("sv-SE", {
          timeZone: timezone,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hourCycle: "h23",
        }).format(date),
      };
    },
  });
}
