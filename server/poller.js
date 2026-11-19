import { activeTasks, hasMediaCall, recordAiCall, recordTaskEvent, registerTaskFile, settleTaskQuota, updateTask } from './db.js';
import { provider } from './providers/index.js';
import { config } from './config.js';

let busy = false;

async function tick() {
  const tasks = activeTasks();
  for (const task of tasks) {
    if (Date.now() - task.created_at > config.taskTimeoutMs) {
      const message = `超时：超过 ${Math.round(config.taskTimeoutMs / 60000)} 分钟仍未完成`;
      updateTask(task.id, { status: 'failed', progress: 100, error: message });
      recordTaskEvent(task.id, 'timeout', { message });
      recordAiCall({ kind: task.type, model: task.req_key, taskId: task.id, latencyMs: Date.now() - task.created_at, status: 'error', error: message });
      continue;
    }

    try {
      // 同步 provider（比如 Seedream）会阻塞十几秒，先把状态置成 running，避免前端一直显示 queued
      if (task.status === 'queued') updateTask(task.id, { status: 'running', progress: 5 });
      const result = await provider.poll(task);
      const patch = { progress: result.progress ?? task.progress };

      if (result.remoteId && result.remoteId !== task.remote_task_id) {
        patch.remote_task_id = result.remoteId;
        recordTaskEvent(task.id, 'submitted', { remoteTaskId: result.remoteId, model: task.req_key });
      }
      patch.status = result.status === 'running' ? 'running' : result.status;

      if (result.status === 'done') {
        patch.local_path = result.localPath || null;
        if (patch.local_path) registerTaskFile(task.id, patch.local_path);
        patch.result_url = result.resultUrl || null;
        patch.cost_ms = Date.now() - task.created_at;
        recordTaskEvent(task.id, 'completed', { resultUrl: result.resultUrl, costMs: patch.cost_ms });
        // 媒体成本：图片按张、视频按上游返回的 token
        const mediaTokens = Number(result.usage?.total_tokens) || 0;
        const mediaCost = provider.name === 'ark'
          ? (task.type === 'image' ? config.ark.price.image : (mediaTokens / 1e6) * config.ark.price.video)
          : 0;
        // 续传（有 remote id 的失败重试）不重复记账，避免 tracing 金额虚高
        const alreadyCounted = Boolean(task.remote_task_id) && hasMediaCall(task.id);
        if (!alreadyCounted) recordAiCall({
          kind: task.type,
          model: task.req_key,
          taskId: task.id,
          completionTokens: mediaTokens,
          totalTokens: mediaTokens,
          latencyMs: patch.cost_ms,
          status: 'ok',
          costCny: Number(mediaCost.toFixed(4)),
          meta: { resultUrl: result.resultUrl },
        });
        // 积分结算：按真实成本换算（mock provider 成本为 0 时回落到预占值）
        settleTaskQuota(task.id, mediaCost);
      }
      if (result.status === 'failed') {
        patch.error = result.error || '生成失败';
        recordTaskEvent(task.id, 'failed', { error: patch.error });
        recordAiCall({
          kind: task.type,
          model: task.req_key,
          taskId: task.id,
          latencyMs: Date.now() - task.created_at,
          status: 'error',
          error: patch.error,
        });
      }
      updateTask(task.id, patch);
    } catch (error) {
      const attempts = (task.attempts || 0) + 1;
      // 图片是同步接口：请求可能已经计费成功，自动重试等于重复出图，所以只判失败不重试
      const giveUp = attempts >= config.maxAttempts || task.type === 'image';
      updateTask(task.id, {
        attempts,
        status: giveUp ? 'failed' : task.status,
        progress: giveUp ? 100 : task.progress,
        error: error.message,
      });
      recordTaskEvent(task.id, 'error', { attempt: attempts, error: error.message, giveUp });
      if (giveUp) {
        recordAiCall({
          kind: task.type,
          model: task.req_key,
          taskId: task.id,
          latencyMs: Date.now() - task.created_at,
          status: 'error',
          error: error.message,
        });
      }
      console.warn(`[poller] ${task.id} 第 ${attempts} 次失败：${error.message}`);
    }
  }
}

export function startPoller() {
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await tick();
    } catch (error) {
      console.error('[poller] tick 失败', error);
    } finally {
      busy = false;
    }
  }, config.pollIntervalMs);
  timer.unref?.();
  return timer;
}
