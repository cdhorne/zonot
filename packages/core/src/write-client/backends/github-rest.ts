// GitHubRestBackend — the stateless Worker-side GitHub REST adapter (ADR-0022 /
// 0013; worker-spec §4). Implements the WriteClient over the GitHub Git Data API
// so a note + its source land in ONE commit (atomic; worker-spec §4.3), plus the
// v1.0 tree-walk reads (listRecent/listTags) until the edge index lands (v1.2).
// Provenance rides in commit trailers (ADR-0007), never frontmatter.
//
// SHA discipline (authority-or-bust, worker-spec §4.3): every conditional op
// refetches the head tree and compares the note's current blob sha to the
// caller's base_sha before committing — a mismatch is SHAConflictError (412 →
// the caller refetches and reapplies). SHAs are never cached between requests.
//
// Idempotency (core-spec §3.4) is an operator concern handled ABOVE this backend
// (Worker KV / CLI sqlite), so idempotency_key is accepted but not consulted here.
//
// Imported only by clone-less runtimes (the Worker); other consumers skip this
// subpath so the isomorphic-git backend never enters their bundle.

import {
  assembleNoteFile,
  assembleSourceFile,
  buildNoteFrontmatter,
  buildSourceFrontmatter,
  deriveNotePath,
  deriveSourcePath,
  generateUlid,
  parseNoteFile,
  parseSourceFile,
  slugify,
  splitBody,
} from '../../convention/index.ts';
import {
  NotFoundError,
  SHAConflictError,
  UnauthorizedError,
  UpstreamDownError,
  UpstreamRateLimitedError,
  WorkspaceNotInitializedError,
} from '../../errors/index.ts';
import { buildCommitMessage } from '../../provenance/index.ts';
import type {
  AppendInput,
  CaptureInput,
  CorrectInput,
  DeleteInput,
  HeadInput,
  HeadResult,
  InitInput,
  InitResult,
  ListRecentInput,
  ListTagsInput,
  NoteRecord,
  NoteSummary,
  ReadInput,
  SourceRecord,
  TagSummary,
  UndoInput,
  WriteResult,
} from '../../schema/index.ts';
import type { WriteClient } from '../interface.ts';

export interface GitHubRestBackendConfig {
  owner: string;
  repo: string;
  token: string;
  /** Target branch. Default: main. */
  branch?: string;
  /** Override for GitHub Enterprise. Default: https://api.github.com */
  baseUrl?: string;
  /** Provenance `Source` trailer for writes through this instance. Default: github-rest. */
  source?: string;
  /** Injectable clock (ISO-8601 UTC). Default: () => new Date().toISOString(). */
  now?: () => string;
  /** Injectable id generator. Default: generateUlid. */
  newId?: () => string;
  /** Injectable fetch (tests). Default: globalThis.fetch. */
  fetch?: typeof fetch;
}

const ZONOT_MARKER = 'zonot.json';
const BLOB_MODE = '100644' as const;

interface TreeEntry {
  path: string;
  type: string;
  sha: string;
}

interface Head {
  commitSha: string;
  treeSha: string;
}

/** A create/modify (content) or delete (content: null) entry for a commit. */
interface CommitFile {
  path: string;
  content: string | null;
}

export class GitHubRestBackend implements WriteClient {
  readonly #config: GitHubRestBackendConfig;
  readonly #branch: string;
  readonly #baseUrl: string;
  readonly #source: string;
  readonly #now: () => string;
  readonly #newId: () => string;
  readonly #fetch: typeof fetch;

  constructor(config: GitHubRestBackendConfig) {
    this.#config = config;
    this.#branch = config.branch ?? 'main';
    this.#baseUrl = (config.baseUrl ?? 'https://api.github.com').replace(/\/$/, '');
    this.#source = config.source ?? 'github-rest';
    this.#now = config.now ?? (() => new Date().toISOString());
    this.#newId = config.newId ?? generateUlid;
    this.#fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Resolved configuration (test introspection; not part of the WriteClient surface). */
  getConfig(): Readonly<GitHubRestBackendConfig> {
    return this.#config;
  }

  // --- init ----------------------------------------------------------------

  async init(_input: InitInput): Promise<InitResult> {
    const head = await this.#getHead();
    const existing = head ? await this.#getTreeEntries(head.treeSha) : [];
    const present = new Set(existing.map((e) => e.path));

    const files: CommitFile[] = [];
    if (!present.has(ZONOT_MARKER)) {
      files.push({ path: ZONOT_MARKER, content: `${JSON.stringify({ convention_version: 1 })}\n` });
    }
    if (!present.has('notes/.gitkeep')) files.push({ path: 'notes/.gitkeep', content: '' });
    if (!present.has('sources/.gitkeep')) files.push({ path: 'sources/.gitkeep', content: '' });

    if (files.length === 0) {
      // Already initialized — idempotent no-op; report current head.
      return { commit_sha: head?.commitSha ?? '', paths: [ZONOT_MARKER] };
    }

    const message = buildCommitMessage({
      subject: 'init: scaffold zonot workspace',
      trailers: { source: this.#source, captureId: this.#newId() },
    });
    const commit_sha = await this.#mutate(files, message);
    return { commit_sha, paths: files.map((f) => f.path) };
  }

  // --- capture -------------------------------------------------------------

  async capture(input: CaptureInput): Promise<WriteResult> {
    // capture_id := note id. A note's identity IS its creating capture, so undo
    // (which resolves by capture_id) and delete (which resolves by id) share
    // one by-id resolution path and differ only by intent trailer (ADR-0026
    // "the split is intent-signalling"). Every later mutation event gets its own
    // fresh Capture-Id, so git history keeps unique per-event ids throughout.
    const id = this.#newId();
    const created = this.#now();
    const slug = slugify(
      input.output.title === undefined ? { id } : { title: input.output.title, id },
    );
    const notePath = deriveNotePath({ id, slug, created });

    const files: CommitFile[] = [];
    let sourceId: string | undefined;
    let sourcePath: string | undefined;

    // A source node is written iff a distinct verbatim `raw` was supplied
    // (core-spec §3.5 / §6 — byte-identical raw+body writes no source node).
    if (input.raw !== undefined && input.raw !== input.output.body) {
      sourceId = this.#newId();
      sourcePath = deriveSourcePath({ id: sourceId, created });
      const sfm = buildSourceFrontmatter({
        id: sourceId,
        created,
        noteId: id,
        source: this.#source,
      });
      files.push({
        path: sourcePath,
        content: assembleSourceFile(sfm, ensureTrailingNewline(input.raw)),
      });
    }

    const nfm = buildNoteFrontmatter({
      id,
      created,
      workspace: input.workspace,
      thread: input.thread,
      output: input.output,
      sourceId,
    });
    files.push({
      path: notePath,
      content: assembleNoteFile(nfm, ensureBodyShape(input.output.body)),
    });

    const message = buildCommitMessage({
      subject: subject('capture', input.output.title, id),
      trailers: { source: this.#source, captureId: id },
    });
    const commit_sha = await this.#mutate(files, message);

    return {
      id,
      path: notePath,
      ...(sourcePath ? { source_path: sourcePath } : {}),
      commit_sha,
      url: this.#blobUrl(notePath),
      applied_tags: nfm.tags,
      capture_id: id,
    };
  }

  // --- append --------------------------------------------------------------

  async append(input: AppendInput): Promise<WriteResult> {
    return this.#conditionalEdit(input.id, input.base_sha, (parsed) => {
      const compiled = parsed.body_compiled.replace(/\n+$/, '');
      const existing = parsed.body_timeline.replace(/^\n+/, '').replace(/\n+$/, '');
      const block = input.block.replace(/\n+$/, '');
      const timeline = existing ? `${existing}\n${block}` : block;
      const body = `${compiled}\n\n---\n\n${timeline}\n`;

      const fm = { ...parsed.frontmatter, updated: this.#now() };
      const captureId = this.#newId();
      return {
        body,
        frontmatter: fm,
        captureId,
        message: buildCommitMessage({
          subject: `append to ${input.id}`,
          trailers: { source: this.#source, captureId },
        }),
      };
    });
  }

  // --- correct -------------------------------------------------------------

  async correct(input: CorrectInput): Promise<WriteResult> {
    return this.#conditionalEdit(input.id, input.base_sha, (parsed) => {
      // output.body becomes the new compiled body; the existing timeline is
      // preserved (core-spec §3.2). Any divider inside output.body is honored.
      const newCompiled = splitBody(input.output.body).compiled.replace(/\n+$/, '');
      const timeline = parsed.body_timeline.replace(/^\n+/, '').replace(/\n+$/, '');
      const body = timeline ? `${newCompiled}\n\n---\n\n${timeline}\n` : `${newCompiled}\n`;

      // Rebuild facets from the corrected output; preserve identity + timeline-bearing fields.
      const prev = parsed.frontmatter;
      const fm = buildNoteFrontmatter({
        id: prev.id,
        created: prev.created,
        workspace: prev.workspace,
        thread: prev.thread,
        output: input.output,
        sourceId: prev.source,
      });
      fm.updated = this.#now();

      const captureId = this.#newId();
      return {
        body,
        frontmatter: fm,
        captureId,
        message: buildCommitMessage({
          subject: subject('correct', input.output.title, input.id),
          trailers: { source: this.#source, captureId, editOf: input.id },
        }),
      };
    });
  }

  // --- undo / delete -------------------------------------------------------

  async undo(input: UndoInput): Promise<WriteResult> {
    // capture_id == the note id (see capture). Removes note + source as a
    // delete-commit stamped Undo-Of; identical resolution to delete, different intent.
    return this.#removeNote(input.capture_id, {
      subjectVerb: 'undo',
      subjectArg: input.capture_id,
      trailerKey: 'undoOf',
    });
  }

  async delete(input: DeleteInput): Promise<WriteResult> {
    return this.#removeNote(input.id, {
      subjectVerb: 'delete',
      subjectArg: input.id,
      trailerKey: 'deleteOf',
    });
  }

  // --- read ----------------------------------------------------------------

  async readNote(input: ReadInput): Promise<NoteRecord> {
    const head = await this.#requireHead();
    const entries = await this.#getTreeEntries(head.treeSha);
    const note = findNote(input.id, entries);
    if (!note) throw new NotFoundError(`note ${input.id}`);

    const content = await this.#getBlobUtf8(note.sha);
    const parsed = parseNoteFile(content, note.path);

    let source: SourceRecord | undefined;
    if (input.include_source && parsed.frontmatter.source) {
      const src = findSource(parsed.frontmatter.source, entries);
      if (src) {
        const srcParsed = parseSourceFile(await this.#getBlobUtf8(src.sha), src.path);
        source = {
          id: srcParsed.frontmatter.id,
          path: src.path,
          frontmatter: srcParsed.frontmatter,
          body: srcParsed.body,
          sha: src.sha,
        };
      }
    }

    return {
      id: parsed.frontmatter.id,
      path: note.path,
      frontmatter: parsed.frontmatter,
      body_compiled: parsed.body_compiled,
      body_timeline: parsed.body_timeline,
      raw_body: parsed.raw_body,
      sha: note.sha,
      ...(source ? { source } : {}),
    };
  }

  async head(input: HeadInput): Promise<HeadResult | null> {
    const head = await this.#getHead();
    if (!head) return null;
    const note = findNote(input.id, await this.#getTreeEntries(head.treeSha));
    return note ? { sha: note.sha, path: note.path } : null;
  }

  // --- v1.0 tree-walk reads ------------------------------------------------
  // listRecent / listTags walk the GitHub tree and parse note blobs on each
  // call (no edge index until v1.2 — ADR-0009). They are NOT part of the
  // WriteClient interface; the Worker calls them on the concrete class. Cost:
  // listRecent reads ~limit blobs; listTags reads every note blob (O(repo)).
  // Both are superseded by the SearchEngine over the materialized index at v1.2.

  /** Most-recent notes as summaries (newest first), optionally bounded by `since`. */
  async listRecent(input: ListRecentInput): Promise<NoteSummary[]> {
    const limit = clampLimit(input.limit);
    const head = await this.#getHead();
    if (!head) return [];
    const notePaths = notePathsNewestFirst(await this.#getTreeEntries(head.treeSha));

    const summaries: NoteSummary[] = [];
    for (const entry of notePaths) {
      if (summaries.length >= limit) break;
      const parsed = parseNoteFile(await this.#getBlobUtf8(entry.sha), entry.path);
      if (input.since && parsed.frontmatter.created < input.since) continue;
      summaries.push(toSummary(entry.path, parsed.frontmatter));
    }
    // Path order ≈ created order (ULID time-prefix); sort the page precisely.
    summaries.sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
    return summaries;
  }

  /** Tag → count across the whole corpus, optionally filtered by prefix. */
  async listTags(input: ListTagsInput): Promise<TagSummary[]> {
    const head = await this.#getHead();
    if (!head) return [];
    const notePaths = notePathsNewestFirst(await this.#getTreeEntries(head.treeSha));

    const counts = new Map<string, number>();
    for (const entry of notePaths) {
      const parsed = parseNoteFile(await this.#getBlobUtf8(entry.sha), entry.path);
      for (const tag of parsed.frontmatter.tags) {
        if (input.prefix && !tag.startsWith(input.prefix)) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : 1));
  }

  // --- shared mutation paths -----------------------------------------------

  /**
   * Read-modify-write a single note under the SHA-conditional contract. Resolves
   * id → path, asserts the blob sha matches base_sha, then commits the edit.
   */
  async #conditionalEdit(
    id: string,
    baseSha: string,
    edit: (parsed: ReturnType<typeof parseNoteFile>) => {
      body: string;
      frontmatter: Parameters<typeof assembleNoteFile>[0];
      captureId: string;
      message: string;
    },
  ): Promise<WriteResult> {
    const head = await this.#requireHead();
    const entries = await this.#getTreeEntries(head.treeSha);
    const note = findNote(id, entries);
    if (!note) throw new NotFoundError(`note ${id}`);
    if (note.sha !== baseSha) throw new SHAConflictError(note.path, baseSha, note.sha);

    const parsed = parseNoteFile(await this.#getBlobUtf8(note.sha), note.path);
    const result = edit(parsed);
    const content = assembleNoteFile(result.frontmatter, result.body);

    const commit = await this.#createCommit(result.message, head, [{ path: note.path, content }]);
    const advanced = await this.#advanceRef(commit, head);
    if (!advanced) throw await this.#conflictFor(id, note.path, baseSha);

    return {
      id,
      path: note.path,
      commit_sha: commit,
      url: this.#blobUrl(note.path),
      applied_tags: result.frontmatter.tags,
      capture_id: result.captureId,
    };
  }

  async #removeNote(
    id: string,
    opts: { subjectVerb: string; subjectArg: string; trailerKey: 'undoOf' | 'deleteOf' },
  ): Promise<WriteResult> {
    const head = await this.#requireHead();
    const entries = await this.#getTreeEntries(head.treeSha);
    const note = findNote(id, entries);
    if (!note) throw new NotFoundError(`note ${id}`);

    const parsed = parseNoteFile(await this.#getBlobUtf8(note.sha), note.path);
    const files: CommitFile[] = [{ path: note.path, content: null }];
    let sourcePath: string | undefined;
    if (parsed.frontmatter.source) {
      const src = findSource(parsed.frontmatter.source, entries);
      if (src) {
        sourcePath = src.path;
        files.push({ path: src.path, content: null });
      }
    }

    const captureId = this.#newId();
    const message = buildCommitMessage({
      subject: `${opts.subjectVerb} ${opts.subjectArg}`,
      trailers: { source: this.#source, captureId, [opts.trailerKey]: id },
    });
    const commit_sha = await this.#mutate(files, message);

    return {
      id,
      path: note.path,
      ...(sourcePath ? { source_path: sourcePath } : {}),
      commit_sha,
      applied_tags: parsed.frontmatter.tags,
      capture_id: captureId,
    };
  }

  /** Non-conditional commit with fast-forward retry (capture/init/undo/delete). */
  async #mutate(files: CommitFile[], message: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const head = await this.#getHead();
      const commit = await this.#createCommit(message, head, files);
      if (await this.#advanceRef(commit, head)) return commit;
    }
    throw new UpstreamDownError('ref update failed after 3 attempts (concurrent writes)');
  }

  // --- GitHub Git Data primitives ------------------------------------------

  async #getHead(): Promise<Head | null> {
    const ref = await this.#json<{ object: { sha: string } }>(
      'GET',
      `/git/ref/heads/${this.#branch}`,
      undefined,
      { allow404: true },
    );
    if (!ref) return null;
    const commit = await this.#json<{ tree: { sha: string } }>(
      'GET',
      `/git/commits/${ref.object.sha}`,
    );
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
  }

  async #requireHead(): Promise<Head> {
    const head = await this.#getHead();
    if (!head) throw new WorkspaceNotInitializedError(`${this.#config.owner}/${this.#config.repo}`);
    return head;
  }

  async #getTreeEntries(treeSha: string): Promise<TreeEntry[]> {
    const tree = await this.#json<{ tree: TreeEntry[]; truncated: boolean }>(
      'GET',
      `/git/trees/${treeSha}?recursive=1`,
    );
    if (tree.truncated) {
      // A truncated tree could hide a note path → a false NotFound. Fail loud
      // rather than silently. (Lifts to v1.2 edge-search index; ADR-0009.)
      throw new UpstreamDownError('git tree truncated; repo too large for recursive listing');
    }
    return tree.tree;
  }

  async #getBlobUtf8(sha: string): Promise<string> {
    const blob = await this.#json<{ content: string; encoding: string }>(
      'GET',
      `/git/blobs/${sha}`,
    );
    const b64 = blob.content.replace(/\n/g, '');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /** Build a tree on the current head and a commit pointing at it (no ref move yet). */
  async #createCommit(message: string, head: Head | null, files: CommitFile[]): Promise<string> {
    const tree = await this.#json<{ sha: string }>('POST', '/git/trees', {
      ...(head ? { base_tree: head.treeSha } : {}),
      tree: files.map((f) =>
        f.content === null
          ? { path: f.path, mode: BLOB_MODE, type: 'blob', sha: null }
          : { path: f.path, mode: BLOB_MODE, type: 'blob', content: f.content },
      ),
    });
    const commit = await this.#json<{ sha: string }>('POST', '/git/commits', {
      message,
      tree: tree.sha,
      parents: head ? [head.commitSha] : [],
    });
    return commit.sha;
  }

  /** Move the branch ref to a new commit. Returns false on a non-fast-forward. */
  async #advanceRef(commitSha: string, head: Head | null): Promise<boolean> {
    if (!head) {
      await this.#json('POST', '/git/refs', { ref: `refs/heads/${this.#branch}`, sha: commitSha });
      return true;
    }
    const res = await this.#request('PATCH', `/git/refs/heads/${this.#branch}`, {
      sha: commitSha,
      force: false,
    });
    if (res.ok) return true;
    if (res.status === 422) return false; // not a fast-forward — concurrent write
    await this.#raise(res);
    return false;
  }

  async #conflictFor(id: string, path: string, baseSha: string): Promise<SHAConflictError> {
    const head = await this.#getHead();
    const fresh = head ? findNote(id, await this.#getTreeEntries(head.treeSha)) : null;
    return new SHAConflictError(path, baseSha, fresh?.sha ?? null);
  }

  // --- HTTP plumbing -------------------------------------------------------

  #blobUrl(path: string): string {
    return `https://github.com/${this.#config.owner}/${this.#config.repo}/blob/${this.#branch}/${path}`;
  }

  #request(method: string, apiPath: string, body?: unknown): Promise<Response> {
    return this.#fetch(
      `${this.#baseUrl}/repos/${this.#config.owner}/${this.#config.repo}${apiPath}`,
      {
        method,
        headers: {
          authorization: `Bearer ${this.#config.token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          'user-agent': 'zonot-worker',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
    );
  }

  async #json<T>(
    method: string,
    apiPath: string,
    body?: unknown,
    opts?: { allow404?: boolean },
  ): Promise<T> {
    const res = await this.#request(method, apiPath, body);
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
    if (res.status === 404 && opts?.allow404) return null as T;
    await this.#raise(res);
    throw new Error('unreachable');
  }

  async #raise(res: Response): Promise<never> {
    if (res.status === 401) throw new UnauthorizedError('github rejected the token');
    if (res.status === 403 || res.status === 429) {
      throw new UpstreamRateLimitedError(retryAfterSeconds(res));
    }
    if (res.status === 404) throw new NotFoundError('github resource');
    const detail = await res.text().catch(() => '');
    throw new UpstreamDownError(
      `github ${res.status}${detail ? `: ${truncate(detail, 200)}` : ''}`,
    );
  }
}

// --- module helpers --------------------------------------------------------

function findNote(id: string, entries: TreeEntry[]): { path: string; sha: string } | null {
  const re = new RegExp(`^notes/\\d{4}/\\d{2}/${id}-.*\\.md$`);
  const hit = entries.find((e) => e.type === 'blob' && re.test(e.path));
  return hit ? { path: hit.path, sha: hit.sha } : null;
}

function findSource(sourceId: string, entries: TreeEntry[]): { path: string; sha: string } | null {
  const re = new RegExp(`^sources/\\d{4}/\\d{2}/${sourceId}\\.md$`);
  const hit = entries.find((e) => e.type === 'blob' && re.test(e.path));
  return hit ? { path: hit.path, sha: hit.sha } : null;
}

const NOTE_PATH = /^notes\/\d{4}\/\d{2}\/[0-9A-HJKMNP-TV-Z]{26}-.*\.md$/;

/** Note blobs sorted newest-first by path (paths embed YYYY/MM then the ULID). */
function notePathsNewestFirst(entries: TreeEntry[]): TreeEntry[] {
  return entries
    .filter((e) => e.type === 'blob' && NOTE_PATH.test(e.path))
    .sort((a, b) => (a.path < b.path ? 1 : a.path > b.path ? -1 : 0));
}

function toSummary(
  path: string,
  fm: {
    id: string;
    title?: string | undefined;
    tags: string[];
    type?: string | undefined;
    thread?: string | undefined;
    created: string;
    updated?: string | undefined;
  },
): NoteSummary {
  return {
    id: fm.id,
    path,
    title: fm.title ?? '',
    tags: fm.tags,
    type: fm.type ?? 'note',
    ...(fm.thread ? { thread: fm.thread } : {}),
    created: fm.created,
    ...(fm.updated ? { updated: fm.updated } : {}),
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return 20;
  return Math.max(1, Math.min(100, limit));
}

/** A capture body always ends with a newline; an empty body becomes one blank line. */
function ensureBodyShape(body: string): string {
  if (body === '') return '\n';
  return ensureTrailingNewline(body);
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}

/** Single-line commit subject; collapses any whitespace, falls back to the id. */
function subject(verb: string, title: string | undefined, id: string): string {
  const t = title?.replace(/\s+/g, ' ').trim();
  return t ? `${verb}: ${t}` : `${verb}: ${id}`;
}

function retryAfterSeconds(res: Response): number {
  const retryAfter = res.headers.get('retry-after');
  if (retryAfter) return Math.max(1, Number(retryAfter) || 60);
  const reset = res.headers.get('x-ratelimit-reset');
  if (reset) return Math.max(1, Number(reset) - Math.floor(Date.now() / 1000));
  return 60;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
