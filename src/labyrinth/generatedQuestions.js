import { randInt, pick, shuffle } from './rng.js';

/**
 * Questions computed from a seed rather than written out: number sequences,
 * mental arithmetic, clocks, weekdays, Roman numerals, unit conversions and
 * age puzzles. There are effectively infinitely many, so the Labyrinth never
 * runs out of fresh prompts, and every wrong choice is a mistake people
 * actually make (an off-by-one, a forgotten carry, the wrong step) rather
 * than a random number.
 *
 * Every generator returns a question with the same shape as the written bank:
 * `{ id, category, difficulty, prompt, choices, answer }`.
 */

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const between = (rng, min, max) => min + randInt(rng, max - min + 1);

/** Shuffles the correct answer in among three distinct wrong ones. */
function build(rng, { id, category, difficulty, prompt, correct, wrong }) {
  const right = String(correct);
  const seen = new Set([right]);
  const distractors = [];
  for (const candidate of wrong) {
    const text = String(candidate);
    if (seen.has(text)) continue;
    seen.add(text);
    distractors.push(text);
    if (distractors.length === 3) break;
  }
  // Numeric questions can always be topped up with near misses.
  for (let k = 1; distractors.length < 3 && Number.isFinite(Number(right)); k++) {
    for (const text of [String(Number(right) + k), String(Number(right) - k)]) {
      if (distractors.length < 3 && !seen.has(text)) {
        seen.add(text);
        distractors.push(text);
      }
    }
  }
  const choices = shuffle(rng, [right, ...distractors]);
  return { id, category, difficulty, prompt, choices, answer: choices.indexOf(right), generated: true };
}

function sequence(rng, difficulty, id) {
  const kinds = difficulty >= 3 ? ['squares', 'fibonacci', 'interleaved', 'growing'] : ['arithmetic', 'geometric', 'growing'];
  const kind = pick(rng, kinds);
  let terms;
  let next;
  let wrong;

  if (kind === 'arithmetic') {
    const start = between(rng, 2, 40);
    const step = between(rng, 3, 17) * (rng() < 0.3 ? -1 : 1);
    terms = Array.from({ length: 5 }, (_, i) => start + step * i);
    next = start + step * 5;
    wrong = [next + step, next - 1, next + 1, next - step];
  } else if (kind === 'geometric') {
    const start = between(rng, 2, 6);
    const ratio = between(rng, 2, 3);
    terms = Array.from({ length: 5 }, (_, i) => start * ratio ** i);
    next = start * ratio ** 5;
    wrong = [terms[4] + (terms[4] - terms[3]), next * ratio, next + start, next - ratio];
  } else if (kind === 'growing') {
    const start = between(rng, 1, 20);
    const first = between(rng, 1, 5);
    const grow = between(rng, 1, 3);
    terms = [start];
    for (let i = 0; i < 4; i++) terms.push(terms[i] + first + grow * i);
    next = terms[4] + first + grow * 4;
    wrong = [terms[4] + first + grow * 3, next + grow, next - 1, next + 1];
  } else if (kind === 'squares') {
    const n = between(rng, 2, 7);
    const offset = between(rng, -3, 5);
    terms = Array.from({ length: 5 }, (_, i) => (n + i) ** 2 + offset);
    next = (n + 5) ** 2 + offset;
    wrong = [terms[4] + (terms[4] - terms[3]), next + 1, next - 2, (n + 5) ** 2];
  } else if (kind === 'fibonacci') {
    const a = between(rng, 1, 6);
    const b = between(rng, a + 1, a + 7);
    terms = [a, b];
    while (terms.length < 6) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
    next = terms[4] + terms[5];
    terms = terms.slice(0, 6);
    wrong = [terms[5] + (terms[5] - terms[4]), next + 1, next - terms[3], terms[5] * 2];
  } else {
    // Two arithmetic sequences woven together: a1 b1 a2 b2 a3 b3 -> a4.
    const a = between(rng, 1, 15);
    const da = between(rng, 2, 6);
    const b = between(rng, 20, 60);
    const db = between(rng, 3, 9) * -1;
    terms = [a, b, a + da, b + db, a + 2 * da, b + 2 * db];
    next = a + 3 * da;
    wrong = [b + 3 * db, a + 2 * da + db, next + da, next - 1];
  }

  return build(rng, {
    id,
    category: 'logique',
    difficulty,
    prompt: `Quel nombre vient ensuite : ${terms.join(', ')}, … ?`,
    correct: next,
    wrong,
  });
}

function mental(rng, difficulty, id) {
  if (difficulty >= 3 && rng() < 0.5) {
    const percent = pick(rng, [12, 15, 35, 45, 65, 75, 85]);
    const base = between(rng, 4, 36) * 20;
    const correct = (percent * base) / 100;
    return build(rng, {
      id,
      category: 'logique',
      difficulty,
      prompt: `Combien font ${percent} % de ${base} ?`,
      correct,
      wrong: [correct + 10, correct - 10, (percent * base) / 10, correct + percent],
    });
  }
  const a = difficulty >= 3 ? between(rng, 23, 69) : between(rng, 13, 29);
  const b = difficulty >= 3 ? between(rng, 13, 39) : between(rng, 4, 9);
  const correct = a * b;
  return build(rng, {
    id,
    category: 'logique',
    difficulty,
    prompt: `Calcul mental : combien font ${a} × ${b} ?`,
    correct,
    wrong: [correct + 10, correct - 10, correct + a, correct - b, correct + 100],
  });
}

const fmtTime = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};

function clock(rng, difficulty, id) {
  const start = between(rng, 6, 21) * 60 + between(rng, 1, 11) * 5;
  const add = between(rng, 1, difficulty >= 3 ? 9 : 4) * 60 + between(rng, 1, 11) * 5;
  const end = start + add;
  return build(rng, {
    id,
    category: 'logique',
    difficulty,
    prompt: `Il est ${fmtTime(start)}. Quelle heure sera-t-il dans ${Math.floor(add / 60)} h ${String(add % 60).padStart(2, '0')} ?`,
    correct: fmtTime(end),
    // Forgetting the carry into the hour is the classic slip.
    wrong: [fmtTime(end - 60), fmtTime(end + 60), fmtTime(end - 10), fmtTime(end + 10)],
  });
}

function weekday(rng, difficulty, id) {
  const from = randInt(rng, 7);
  const days = difficulty >= 3 ? between(rng, 40, 400) : between(rng, 8, 30);
  const correct = DAYS[(from + days) % 7];
  return build(rng, {
    id,
    category: 'logique',
    difficulty,
    prompt: `Nous sommes un ${DAYS[from]}. Quel jour serons-nous dans ${days} jours ?`,
    correct,
    wrong: [DAYS[(from + days + 1) % 7], DAYS[(from + days + 6) % 7], DAYS[(from + days + 2) % 7], DAYS[from]],
  });
}

function toRoman(n) {
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [value, glyph] of table) {
    while (n >= value) {
      out += glyph;
      n -= value;
    }
  }
  return out;
}

function roman(rng, difficulty, id) {
  // Numbers built to contain the subtractive pairs (IV, IX, XL, XC, CD, CM) people misread.
  const n =
    difficulty >= 3
      ? between(rng, 1, 2) * 1000 + pick(rng, [400, 900, 0, 800]) + pick(rng, [40, 90, 70]) + pick(rng, [4, 9, 6])
      : between(rng, 1, 3) * 10 + pick(rng, [4, 9, 6, 3]);
  return build(rng, {
    id,
    category: 'logique',
    difficulty,
    prompt: `Que vaut le nombre romain ${toRoman(n)} ?`,
    correct: n,
    wrong: [n + 2, n - 2, n + 20, n + 200, n - 10],
  });
}

function conversion(rng, difficulty, id) {
  const hours = between(rng, 1, difficulty >= 3 ? 5 : 2);
  const minutes = between(rng, 1, 11) * 5;
  const correct = (hours * 60 + minutes) * 60;
  return build(rng, {
    id,
    category: 'sciences',
    difficulty,
    prompt: `Combien de secondes y a-t-il dans ${hours} h ${minutes} min ?`,
    correct,
    wrong: [(hours * 100 + minutes) * 60, hours * 3600 + minutes, correct + 600, correct - 300],
  });
}

function ages(rng, difficulty, id) {
  // Parent is k times the child's age now, and will be m times it in n years.
  const [k, m] = pick(rng, [[3, 2], [4, 2], [5, 3], [4, 3]]);
  let n;
  let child;
  do {
    n = between(rng, 4, 16);
    child = ((m - 1) * n) / (k - m);
  } while (!Number.isInteger(child) || child < 3 || child > 20);
  const parent = k * child;
  return build(rng, {
    id,
    category: 'logique',
    difficulty,
    prompt: `Un parent a ${k} fois l’âge de son enfant. Dans ${n} ans, il n’aura plus que ${m} fois son âge. Quel âge a le parent aujourd’hui ?`,
    correct: parent,
    wrong: [child, parent + n, parent - n, k * n],
  });
}

const GENERATORS_BY_DIFFICULTY = {
  2: [sequence, mental, clock, weekday, roman, conversion],
  3: [sequence, sequence, mental, clock, weekday, roman, conversion, ages],
};

/** A fresh question of the given difficulty (2 or 3), or null below that. */
export function generateQuestion(rng, difficulty) {
  const generators = GENERATORS_BY_DIFFICULTY[Math.min(3, difficulty)];
  if (!generators) return null;
  const generator = pick(rng, generators);
  const id = `gen-${generator.name}-${Math.floor(rng() * 1e9).toString(36)}`;
  return generator(rng, Math.min(3, difficulty), id);
}
