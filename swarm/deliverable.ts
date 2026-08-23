import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const LLM_MODEL = process.env.LLM_MODEL || 'openai/gpt-4o-mini';

interface TaskBrief {
  title: string;
  description: string;
  criteria: string;
}

// The real-work equivalent of Polaris's produceWork() - calls an LLM to generate
// task-specific content, then publishes it as a GitHub gist (gh CLI is already
// authenticated on this host with `gist` scope) so GenVM validators can fetch it
// via gl.nondet.web.render(url). This is proofwork's equivalent of Polaris's
// backend hosting the deliverable for its own /api/deliverable endpoint.
export async function produceDeliverable(task: TaskBrief): Promise<{ url: string; note: string }> {
  const content = await generateContent(task);
  const url = await publishGist(task.title, content);
  return { url, note: 'Produced and submitted by an autonomous agent identity in the AGENTS swarm.' };
}

async function generateContent(task: TaskBrief): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY is not set');

  const prompt = [
    'You are completing a paid task on an AI-verified task marketplace. Produce the',
    'actual deliverable content only - no preamble, no meta-commentary about being an AI.',
    '',
    `Title: ${task.title}`,
    `Description: ${task.description}`,
    `Acceptance criteria (you will be judged against this): ${task.criteria}`,
  ].join('\n');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM call failed: ${res.status} ${await res.text()}`);
  const json: any = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('LLM returned no content');
  return text;
}

async function publishGist(title: string, content: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'proofwork-swarm-'));
  const file = join(dir, 'deliverable.md');
  writeFileSync(file, content, 'utf8');
  try {
    // Secret (unlisted) by default - still fetchable by direct URL with no auth,
    // just not shown on the identity's public gist listing.
    const { stdout } = await execFileAsync('gh', ['gist', 'create', file, '-d', title.slice(0, 100)]);
    const gistUrl = stdout.trim().split('\n').pop()!.trim();
    return `${gistUrl}/raw`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
