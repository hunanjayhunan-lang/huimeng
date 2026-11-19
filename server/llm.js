import { config } from './config.js';
import { arkFetch } from './ark-client.js';
import { chargeLlmQuota, recordAiCall } from './db.js';

/** 从「可能带 ```json 包裹」的回复里抠出 JSON */
export function parseJson(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * 豆包 LLM 封装：LLM_PROVIDER=ark 且配置了 ARK_API_KEY 才真正调用。
 * 每次调用都会写进 ai_calls 表，供 tracing 页看 token 消耗。
 */
export const llm = {
  isEnabled: () => config.llmProvider === 'ark' && Boolean(config.ark.apiKey),
  model: () => config.ark.model,

  async chat(messages, { model = config.ark.model, maxTokens = 1500, temperature = 0.6, json = false, timeoutMs, kind = 'chat' } = {}) {
    const startedAt = Date.now();
    const body = { model, messages, temperature, max_tokens: maxTokens };
    if (json) body.response_format = { type: 'json_object' };
    if (config.ark.disableThinking) body.thinking = { type: 'disabled' };

    try {
      const data = await arkFetch('/chat/completions', { body, timeoutMs });
      const usage = data?.usage || {};
      const costCny = (usage.prompt_tokens || 0) / 1e6 * config.ark.price.llmInput
        + (usage.completion_tokens || 0) / 1e6 * config.ark.price.llmOutput;
      const callId = recordAiCall({
        kind,
        model: data?.model || model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
        latencyMs: Date.now() - startedAt,
        status: 'ok',
        costCny: Number(costCny.toFixed(6)),
        meta: { json, maxTokens, temperature },
        requestId: data?.id || null,
        // tracing：完整请求体与响应体
        input: { model, messages, temperature, max_tokens: maxTokens, response_format: body.response_format, thinking: body.thinking },
        output: data?.choices?.map(choice => ({
          index: choice.index,
          finish_reason: choice.finish_reason,
          role: choice.message?.role,
          content: choice.message?.content,
          reasoning_content: choice.message?.reasoning_content,
        })) || null,
        toolCalls: data?.choices?.flatMap(choice => choice.message?.tool_calls || []) || null,
      });
      // LLM 调用也消耗积分：按 token 数折算，记在 quota_task_usage 里供额度面板汇总
      chargeLlmQuota({ callId, totalTokens: usage.total_tokens, costCny });
      return {
        text: data?.choices?.[0]?.message?.content?.trim() || '',
        usage,
        model: data?.model || model,
      };
    } catch (error) {
      recordAiCall({
        kind,
        model,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        error: error.message,
        meta: { json, maxTokens },
        input: { model, messages, temperature, max_tokens: maxTokens },
      });
      throw error;
    }
  },

  async chatJson(messages, options = {}) {
    const result = await this.chat(messages, { ...options, json: true });
    return { ...result, data: parseJson(result.text) };
  },
};
