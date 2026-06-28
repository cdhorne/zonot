// IsomorphicGitBackend — clone-holder write backend (CLI + mobile). Reuses every
// convention helper + the shared prepare* logic; only storage differs from the
// GitHub backend: writes land in a local working tree and commit via
// isomorphic-git (no network — push is a separate, scheduled concern).
//
// The fs is injected (CLI: node:fs; mobile: a virtual fs) so the core never
// imports node:fs directly. SHA-conditional ops compare the caller's base_sha to
// the working-tree file's git blob sha (same sha semantics as the GitHub backend,
// since both are git blob hashes). Workers never import this subpath, so
// isomorphic-git's weight stays out of the edge bundle.

import git, { type FsClient } from 'isomorphic-git';
import { assembleNoteFile, parseNoteFile, parseSourceFile } from '../../convention/index.ts';
import { generateUlid } from '../../convention/ulid.ts';
import {
  NotFoundError,
  SHAConflictError,
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
  NoteFrontmatter,
  NoteRecord,
  ReadInput,
  SourceRecord,
  UndoInput,
  WriteResult,
} from '../../schema/index.ts';
import type { WriteClient } from '../interface.ts';
import {
  commitSubject,
  type PreparedFile,
  prepareAppend,
  prepareCapture,
  prepareCorrect,
} from '../shared.ts';

/** The subset of node:fs `.promises` the backend needs for direct file I/O. */
interface FsPromises {
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<unknown>;
  readdir(path: string): Promise<string[]>;
  unlink(path: string): Promise<void>;
  stat(path: string): Promise<{ isDirectory(): boolean }>;
}

export interface IsomorphicGitBackendConfig {
  /** Absolute path to the local clone (CLI) or virtual fs root (mobile). */
  dir: string;
  /** isomorphic-git-compatible fs (must also expose `.promises`). */
  fs: FsClient & { promises: FsPromises };
  /** Branch. Default: main. */
  branch?: string;
  /** Remote name (for the CLI's separate push step). Default: origin. */
  remote?: string;
  /** Auth token for remote push/pull (used by the CLI sync layer, not here). */
  token?: string;
  /** Commit author. Default: a generic Zonot identity. */
  author?: { name: string; email: string };
  /** Provenance `Source` trailer. Default: cli:zonot. */
  source?: string;
  now?: () => string;
  newId?: () => string;
}

const ZONOT_MARKER = 'zonot.json';

export class IsomorphicGitBackend implements WriteClient {
  readonly #config: IsomorphicGitBackendConfig;
  readonly #fs: FsClient;
  readonly #fsp: FsPromises;
  readonly #dir: string;
  readonly #branch: string;
  readonly #author: { name: string; email: string };
  readonly #source: string;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(config: IsomorphicGitBackendConfig) {
    this.#config = config;
    this.#fs = config.fs;
    this.#fsp = config.fs.promises;
    this.#dir = config.dir.replace(/\/$/, '');
    this.#branch = config.branch ?? 'main';
    this.#author = config.author ?? { name: 'Zonot', email: 'zonot@localhost' };
    this.#source = config.source ?? 'cli:zonot';
    this.#now = config.now ?? (() => new Date().toISOString());
    this.#newId = config.newId ?? generateUlid;
  }

  getConfig(): Readonly<IsomorphicGitBackendConfig> {
    return this.#config;
  }

  // --- init ----------------------------------------------------------------

  async init(_input: InitInput): Promise<InitResult> {
    if (!(await this.#isRepo())) {
      await git.init({ fs: this.#fs, dir: this.#dir, defaultBranch: this.#branch });
    }
    const scaffold: PreparedFile[] = [
      { path: ZONOT_MARKER, content: `${JSON.stringify({ convention_version: 1 })}\n` },
      { path: 'notes/.gitkeep', content: '' },
      { path: 'sources/.gitkeep', content: '' },
    ];

    const missing: PreparedFile[] = [];
    for (const f of scaffold) if (!(await this.#exists(f.path))) missing.push(f);

    if (missing.length === 0) {
      return { commit_sha: (await this.#headOid()) ?? '', paths: scaffold.map((f) => f.path) };
    }

    const commit_sha = await this.#commit(missing, [], {
      subject: 'init: scaffold zonot workspace',
      captureId: this.#newId(),
    });
    return { commit_sha, paths: missing.map((f) => f.path) };
  }

  // --- capture -------------------------------------------------------------

  async capture(input: CaptureInput): Promise<WriteResult> {
    if (!(await this.#isRepo())) throw new WorkspaceNotInitializedError(this.#dir);
    const id = this.#newId();
    const prepared = prepareCapture(input, {
      id,
      created: this.#now(),
      source: this.#source,
      newSourceId: this.#newId,
    });
    const files = prepared.source ? [prepared.source, prepared.note] : [prepared.note];

    const commit_sha = await this.#commit(files, [], {
      subject: commitSubject('capture', input.output.title, id),
      captureId: id,
    });
    return {
      id,
      path: prepared.note.path,
      ...(prepared.source ? { source_path: prepared.source.path } : {}),
      commit_sha,
      applied_tags: prepared.applied_tags,
      capture_id: id,
    };
  }

  // --- append / correct ----------------------------------------------------

  async append(input: AppendInput): Promise<WriteResult> {
    return this.#conditionalEdit(input.id, input.base_sha, (parsed) => {
      const captureId = this.#newId();
      return {
        ...prepareAppend(parsed, input.block, this.#now()),
        captureId,
        subject: `append to ${input.id}`,
        trailers: {},
      };
    });
  }

  async correct(input: CorrectInput): Promise<WriteResult> {
    return this.#conditionalEdit(input.id, input.base_sha, (parsed) => {
      const captureId = this.#newId();
      return {
        ...prepareCorrect(parsed, input.output, this.#now()),
        captureId,
        subject: commitSubject('correct', input.output.title, input.id),
        trailers: { editOf: input.id },
      };
    });
  }

  // --- undo / delete -------------------------------------------------------

  async undo(input: UndoInput): Promise<WriteResult> {
    return this.#removeNote(input.capture_id, 'undo', 'undoOf');
  }

  async delete(input: DeleteInput): Promise<WriteResult> {
    return this.#removeNote(input.id, 'delete', 'deleteOf');
  }

  // --- read ----------------------------------------------------------------

  async readNote(input: ReadInput): Promise<NoteRecord> {
    const notePath = await this.#findNotePath(input.id);
    if (!notePath) throw new NotFoundError(`note ${input.id}`);
    const content = await this.#read(notePath);
    const parsed = parseNoteFile(content, notePath);

    let source: SourceRecord | undefined;
    if (input.include_source && parsed.frontmatter.source) {
      const srcPath = await this.#findSourcePath(parsed.frontmatter.source);
      if (srcPath) {
        const srcContent = await this.#read(srcPath);
        const srcParsed = parseSourceFile(srcContent, srcPath);
        source = {
          id: srcParsed.frontmatter.id,
          path: srcPath,
          frontmatter: srcParsed.frontmatter,
          body: srcParsed.body,
          sha: await this.#blobSha(srcContent),
        };
      }
    }

    return {
      id: parsed.frontmatter.id,
      path: notePath,
      frontmatter: parsed.frontmatter,
      body_compiled: parsed.body_compiled,
      body_timeline: parsed.body_timeline,
      raw_body: parsed.raw_body,
      sha: await this.#blobSha(content),
      ...(source ? { source } : {}),
    };
  }

  async head(input: HeadInput): Promise<HeadResult | null> {
    const notePath = await this.#findNotePath(input.id);
    if (!notePath) return null;
    return { sha: await this.#blobSha(await this.#read(notePath)), path: notePath };
  }

  // --- shared edit/remove paths --------------------------------------------

  async #conditionalEdit(
    id: string,
    baseSha: string,
    edit: (parsed: ReturnType<typeof parseNoteFile>) => {
      body: string;
      frontmatter: NoteFrontmatter;
      captureId: string;
      subject: string;
      trailers: { editOf?: string };
    },
  ): Promise<WriteResult> {
    if (!(await this.#headOid())) throw new WorkspaceNotInitializedError(this.#dir);
    const notePath = await this.#findNotePath(id);
    if (!notePath) throw new NotFoundError(`note ${id}`);

    const content = await this.#read(notePath);
    const currentSha = await this.#blobSha(content);
    if (currentSha !== baseSha) throw new SHAConflictError(notePath, baseSha, currentSha);

    const result = edit(parseNoteFile(content, notePath));
    const newContent = assembleNoteFile(result.frontmatter, result.body);

    const commit_sha = await this.#commit([{ path: notePath, content: newContent }], [], {
      subject: result.subject,
      captureId: result.captureId,
      ...result.trailers,
    });
    return {
      id,
      path: notePath,
      commit_sha,
      applied_tags: result.frontmatter.tags,
      capture_id: result.captureId,
    };
  }

  async #removeNote(
    id: string,
    verb: string,
    trailerKey: 'undoOf' | 'deleteOf',
  ): Promise<WriteResult> {
    if (!(await this.#headOid())) throw new WorkspaceNotInitializedError(this.#dir);
    const notePath = await this.#findNotePath(id);
    if (!notePath) throw new NotFoundError(`note ${id}`);

    const parsed = parseNoteFile(await this.#read(notePath), notePath);
    const removals = [notePath];
    let sourcePath: string | undefined;
    if (parsed.frontmatter.source) {
      sourcePath = (await this.#findSourcePath(parsed.frontmatter.source)) ?? undefined;
      if (sourcePath) removals.push(sourcePath);
    }

    const captureId = this.#newId();
    const commit_sha = await this.#commit([], removals, {
      subject: `${verb} ${id}`,
      captureId,
      [trailerKey]: id,
    });
    return {
      id,
      path: notePath,
      ...(sourcePath ? { source_path: sourcePath } : {}),
      commit_sha,
      applied_tags: parsed.frontmatter.tags,
      capture_id: captureId,
    };
  }

  /** Write `creates`, stage `removes`, and commit with provenance trailers. */
  async #commit(
    creates: PreparedFile[],
    removes: string[],
    trailers: {
      subject: string;
      captureId: string;
      editOf?: string;
      undoOf?: string;
      deleteOf?: string;
    },
  ): Promise<string> {
    for (const f of creates) {
      await this.#write(f.path, f.content);
      await git.add({ fs: this.#fs, dir: this.#dir, filepath: f.path });
    }
    for (const path of removes) {
      await this.#fsp.unlink(this.#abs(path));
      await git.remove({ fs: this.#fs, dir: this.#dir, filepath: path });
    }
    const { subject, captureId, editOf, undoOf, deleteOf } = trailers;
    return git.commit({
      fs: this.#fs,
      dir: this.#dir,
      author: this.#author,
      message: buildCommitMessage({
        subject,
        trailers: { source: this.#source, captureId, editOf, undoOf, deleteOf },
      }),
    });
  }

  // --- git + fs primitives -------------------------------------------------

  async #isRepo(): Promise<boolean> {
    return this.#exists('.git');
  }

  async #headOid(): Promise<string | null> {
    try {
      return await git.resolveRef({ fs: this.#fs, dir: this.#dir, ref: 'HEAD' });
    } catch {
      return null;
    }
  }

  async #blobSha(content: string): Promise<string> {
    const { oid } = await git.hashBlob({ object: new TextEncoder().encode(content) });
    return oid;
  }

  #abs(relpath: string): string {
    return `${this.#dir}/${relpath}`;
  }

  async #read(relpath: string): Promise<string> {
    return this.#fsp.readFile(this.#abs(relpath), 'utf8');
  }

  async #write(relpath: string, content: string): Promise<void> {
    const abs = this.#abs(relpath);
    const slash = abs.lastIndexOf('/');
    if (slash > 0) await this.#fsp.mkdir(abs.slice(0, slash), { recursive: true });
    await this.#fsp.writeFile(abs, content);
  }

  async #exists(relpath: string): Promise<boolean> {
    try {
      await this.#fsp.stat(this.#abs(relpath));
      return true;
    } catch {
      return false;
    }
  }

  async #findNotePath(id: string): Promise<string | null> {
    return this.#findUnder('notes', (name) => name.startsWith(`${id}-`) && name.endsWith('.md'));
  }

  async #findSourcePath(sourceId: string): Promise<string | null> {
    return this.#findUnder('sources', (name) => name === `${sourceId}.md`);
  }

  /** Walk notes/ or sources/ (YYYY/MM/<file>) for the first matching basename. */
  async #findUnder(root: string, match: (basename: string) => boolean): Promise<string | null> {
    for (const yyyy of await this.#listDirs(root)) {
      for (const mm of await this.#listDirs(`${root}/${yyyy}`)) {
        const dir = `${root}/${yyyy}/${mm}`;
        for (const name of await this.#listEntries(dir)) {
          if (match(name)) return `${dir}/${name}`;
        }
      }
    }
    return null;
  }

  async #listDirs(relpath: string): Promise<string[]> {
    const out: string[] = [];
    for (const name of await this.#listEntries(relpath)) {
      try {
        if ((await this.#fsp.stat(this.#abs(`${relpath}/${name}`))).isDirectory()) out.push(name);
      } catch {
        /* skip */
      }
    }
    return out;
  }

  async #listEntries(relpath: string): Promise<string[]> {
    try {
      return await this.#fsp.readdir(this.#abs(relpath));
    } catch {
      return [];
    }
  }
}
