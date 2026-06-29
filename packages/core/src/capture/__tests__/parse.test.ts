import { describe, expect, test } from 'bun:test';
import { parseCapture } from '../parse.ts';

describe('parseCapture', () => {
  test('extracts #tag / @thread / !type and leaves the body unchanged', () => {
    const body = 'ship the #worker !task for @zonot today';
    const p = parseCapture(body);
    expect(p.body).toBe(body); // LEAVE-in-body
    expect(p.tags).toEqual(['worker']);
    expect(p.thread).toBe('zonot');
    expect(p.type).toBe('task');
    expect(p.chips.map((c) => `${c.sigil}${c.value}`)).toEqual(['#worker', '!task', '@zonot']);
  });

  test('chips render in body-position order with correct ranges', () => {
    const body = '@thread then #tag';
    const chips = parseCapture(body).chips;
    expect(chips.map((c) => c.kind)).toEqual(['thread', 'tag']);
    const [s, e] = chips[0]?.range ?? [0, 0];
    expect(body.slice(s, e)).toBe('@thread');
  });

  test('normalizes + dedups tags; thread/type are first-wins', () => {
    const p = parseCapture('#Foo #foo #FOO @one @two !a !b');
    expect(p.tags).toEqual(['foo']);
    expect(p.thread).toBe('one');
    expect(p.type).toBe('a');
    expect(p.chips).toHaveLength(3); // one tag, one thread, one type
  });

  test('ignores tokens inside fenced code blocks', () => {
    const body = 'real #tag\n```\ncode #nope @nope\n```\nafter !type';
    const p = parseCapture(body);
    expect(p.tags).toEqual(['tag']);
    expect(p.thread).toBeUndefined();
    expect(p.type).toBe('type');
  });

  test('ignores an unclosed fence through end of body', () => {
    const p = parseCapture('lead #yes\n~~~\n#no @no');
    expect(p.tags).toEqual(['yes']);
    expect(p.chips).toHaveLength(1);
  });

  test('requires a word boundary before the sigil (email/inline are not tokens)', () => {
    const p = parseCapture('mail me@example.com or pre#fix');
    expect(p.thread).toBeUndefined();
    expect(p.tags).toEqual([]);
  });

  test('title: first short, period-free line', () => {
    expect(parseCapture('Buy milk\nmore body').title).toBe('Buy milk');
    expect(parseCapture('This sentence ends with a period.').title).toBeUndefined();
    expect(parseCapture(`${'x'.repeat(90)}`).title).toBeUndefined();
  });

  test('title: an H1 heading wins', () => {
    expect(parseCapture('# Heading here\nbody').title).toBe('Heading here');
  });

  test('empty body → no chips, no title', () => {
    const p = parseCapture('');
    expect(p.chips).toEqual([]);
    expect(p.tags).toEqual([]);
    expect(p.title).toBeUndefined();
  });
});
