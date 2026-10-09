import { describe, it, expect } from 'vitest';
import { generateQuestion } from '../src/labyrinth/generatedQuestions.js';
import { mulberry32 } from '../src/labyrinth/rng.js';
import {
  createRun,
  createQuestionSource,
  failLock,
  spendHint,
  resolveDifficultyRange,
  WRONG_ANSWER_PENALTY,
} from '../src/labyrinth/state.js';
import { carveMaze, farthestCell, shortestPath } from '../src/labyrinth/maze.js';
import { cellVisibility } from '../src/labyrinth/render.js';
import { CHAPTERS } from '../src/labyrinth/campaign.js';
import { QUESTIONS } from '../src/labyrinth/questions.js';

describe('generated questions', () => {
  it('always have four distinct choices with the answer among them', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const q = generateQuestion(rng, 2 + (i % 2));
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(q.prompt.length).toBeGreaterThan(10);
    }
  });

  it('computes the right answer', () => {
    const rng = mulberry32(99);
    let checked = 0;
    for (let i = 0; i < 3000; i++) {
      const q = generateQuestion(rng, 3);
      const right = q.choices[q.answer];
      const mul = q.prompt.match(/combien font (\d+) × (\d+)/);
      if (mul) {
        expect(Number(right)).toBe(Number(mul[1]) * Number(mul[2]));
        checked++;
      }
      const pct = q.prompt.match(/Combien font (\d+) % de (\d+)/);
      if (pct) {
        expect(Number(right)).toBe((Number(pct[1]) * Number(pct[2])) / 100);
        checked++;
      }
      const secs = q.prompt.match(/secondes y a-t-il dans (\d+) h (\d+) min/);
      if (secs) {
        expect(Number(right)).toBe((Number(secs[1]) * 60 + Number(secs[2])) * 60);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('are not offered on the easiest level', () => {
    expect(generateQuestion(mulberry32(1), 1)).toBeNull();
  });
});

describe('question source', () => {
  it('stays inside the requested difficulty range', () => {
    const next = createQuestionSource({ minDifficulty: 3, maxDifficulty: 3 }, mulberry32(3));
    for (let i = 0; i < 200; i++) expect(next().difficulty).toBe(3);
  });

  it('prefers written questions the player has not seen yet', () => {
    const inRange = QUESTIONS.filter((q) => q.difficulty <= 2);
    const avoid = new Set(inRange.slice(0, inRange.length - 20).map((q) => q.id));
    const next = createQuestionSource({ minDifficulty: 1, maxDifficulty: 2, avoid, generatedShare: 0 }, mulberry32(5));
    for (let i = 0; i < 20; i++) expect(avoid.has(next().id)).toBe(false);
  });
});

describe('wrong answers and hints', () => {
  const run = createRun({ ...CHAPTERS[2], seed: 1234 });

  it('swaps the question and costs moves on a wrong answer', () => {
    const [edge, lock] = [...run.locks.entries()][0];
    const after = failLock(run, edge);
    expect(after.moves).toBe(run.moves + WRONG_ANSWER_PENALTY);
    expect(after.locks.get(edge).question.id).not.toBe(lock.question.id);
    expect(after.locks.get(edge).kind).toBe(lock.kind);
  });

  it('caps hints at the chapter budget', () => {
    let current = createRun({ ...CHAPTERS[6], seed: 1 });
    expect(current.hintsLeft).toBe(CHAPTERS[6].hintBudget);
    for (let i = 0; i < 5; i++) current = spendHint(current);
    expect(current.hintsLeft).toBe(0);
  });
});

describe('difficulty range', () => {
  it('pins an explicit level to exactly that level', () => {
    expect(resolveDifficultyRange('easy', 3, 3)).toEqual({ minDifficulty: 1, maxDifficulty: 1 });
    expect(resolveDifficultyRange('hard', 1, 2)).toEqual({ minDifficulty: 3, maxDifficulty: 3 });
  });

  it('keeps the chapter range on auto', () => {
    expect(resolveDifficultyRange('auto', 2, 3)).toEqual({ minDifficulty: 2, maxDifficulty: 3 });
  });

  it('makes the late campaign chapters hard-only on auto', () => {
    for (const chapter of CHAPTERS.slice(-3)) expect(chapter.minDifficulty).toBe(3);
  });
});

describe('harder mazes', () => {
  it('puts the exit at the farthest reachable cell', () => {
    const rng = mulberry32(42);
    const cells = carveMaze(15, 10, rng);
    const start = { x: 0, y: 0 };
    const exit = farthestCell(cells, 15, 10, start);
    const exitDistance = shortestPath(cells, 15, 10, start, exit).length;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) {
        expect(shortestPath(cells, 15, 10, start, { x, y }).length).toBeLessThanOrEqual(exitDistance);
      }
    }
  });

  it('branches into more dead ends than a pure depth-first carve', () => {
    const deadEnds = (cells) => [...cells].filter((c) => [1, 2, 4, 8].includes(c)).length;
    let branched = 0;
    let dfs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      branched += deadEnds(carveMaze(15, 10, mulberry32(seed), 0.35));
      dfs += deadEnds(carveMaze(15, 10, mulberry32(seed), 0));
    }
    expect(branched).toBeGreaterThan(dfs * 1.3);
  });

  it('hides unvisited cells outside the torch radius', () => {
    const run = { spec: { vision: 2 }, player: { x: 0, y: 0 }, visited: new Set(['0,0', '5,0']) };
    expect(cellVisibility(run, 1, 1)).toBe('lit');
    expect(cellVisibility(run, 5, 0)).toBe('remembered');
    expect(cellVisibility(run, 6, 6)).toBe('dark');
    expect(cellVisibility({ ...run, spec: { vision: null } }, 6, 6)).toBe('lit');
  });
});
