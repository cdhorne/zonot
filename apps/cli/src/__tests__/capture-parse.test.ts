import { describe, expect, test } from 'bun:test';
import { parseInline } from '../capture-parse.ts';

describe('parseInline', () => {
  test('extracts + normalizes #tags, last @thread, first !type', () => {
    const f = parseInline('Ship it #Design #design @Launch-Q3 !task and @ignored !ignored');
    expect(f.tags).toEqual(['design']); // deduped + lowercased
    expect(f.thread).toBe('ignored'); // last @thread wins
    expect(f.type).toBe('task'); // first !type wins
  });

  test('no facets → empty tags, undefined thread/type', () => {
    expect(parseInline('just a plain note')).toEqual({ tags: [] });
  });

  test('does not match mid-word # (e.g. C# or a url fragment)', () => {
    // "C#" — the # is not preceded by whitespace/start, so it is not a tag.
    expect(parseInline('I like C# a lot').tags).toEqual([]);
  });

  test('a leading-letter #tag is picked up', () => {
    expect(parseInline('#q3-goals and #q3').tags).toEqual(['q3-goals', 'q3']);
  });

  test('a digit-led #tag is body text, not a tag (issue #10)', () => {
    const f = parseInline('filed autopilot#28 → #39, also #30 and #31');
    expect(f.tags).toEqual([]);
  });

  test('!type only matches at a token boundary, not mid-word', () => {
    expect(parseInline('do this!now please').type).toBeUndefined(); // "this!now" is not a !type
    expect(parseInline('urgent !task').type).toBe('task');
  });
});
