/**
 * A small, safe expression parser for the board's graphs: f(x) the way a
 * teacher types it. No eval. Supports + − × ÷ ^, parentheses, implicit
 * multiplication (2x, 3(x+1), x sin x), unary minus, π / pi, e, √, and
 * sin cos tan asin acos atan sqrt abs ln log exp floor ceil round.
 */

type Node =
  | { k: 'num'; v: number }
  | { k: 'x' }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'fn'; f: string; a: Node };

const FNS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

function tokenize(src: string): string[] {
  const s = src
    .replace(/\s+/g, '')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .toLowerCase();
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j]!)) j++;
      out.push(s.slice(i, j));
      i = j;
    } else if (/[a-z]/.test(c)) {
      const name = Object.keys(FNS)
        .concat(['pi'])
        .sort((a, b) => b.length - a.length)
        .find((n) => s.startsWith(n, i));
      if (name) {
        out.push(name);
        i += name.length;
      } else {
        out.push(c);
        i++;
      }
    } else if ('+-*/^()'.includes(c)) {
      out.push(c);
      i++;
    } else {
      throw new Error(`حرف مش مفهوم: ${c}`);
    }
  }
  return out;
}

export function parseExpression(src: string): Node {
  const t = tokenize(src);
  let p = 0;
  const peek = () => t[p];
  const startsFactor = (tok: string | undefined) => tok !== undefined && (/^[0-9.]/.test(tok) || tok === 'x' || tok === 'e' || tok === 'pi' || tok === '(' || tok in FNS);

  function expr(): Node {
    let n = term();
    while (peek() === '+' || peek() === '-') {
      const op = t[p++] as '+' | '-';
      n = { k: 'bin', op, a: n, b: term() };
    }
    return n;
  }
  function term(): Node {
    let n = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/') {
        const op = t[p++] as '*' | '/';
        n = { k: 'bin', op, a: n, b: unary() };
      } else if (startsFactor(peek())) {
        n = { k: 'bin', op: '*', a: n, b: power() };
      } else return n;
    }
  }
  function unary(): Node {
    if (peek() === '-') {
      p++;
      return { k: 'neg', a: unary() };
    }
    if (peek() === '+') {
      p++;
      return unary();
    }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (peek() === '^') {
      p++;
      return { k: 'bin', op: '^', a: base, b: unary() };
    }
    return base;
  }
  function atom(): Node {
    const tok = t[p++];
    if (tok === undefined) throw new Error('المعادلة ناقصة');
    if (/^[0-9.]/.test(tok)) {
      const v = Number(tok);
      if (!Number.isFinite(v)) throw new Error(`رقم غلط: ${tok}`);
      return { k: 'num', v };
    }
    if (tok === 'x') return { k: 'x' };
    if (tok === 'e') return { k: 'num', v: Math.E };
    if (tok === 'pi') return { k: 'num', v: Math.PI };
    if (tok === '(') {
      const n = expr();
      if (t[p++] !== ')') throw new Error('قوس ناقص');
      return n;
    }
    if (tok in FNS) {
      // sin(x) or sin x
      return { k: 'fn', f: tok, a: peek() === '(' ? atom() : power() };
    }
    throw new Error(`مش فاهم "${tok}"`);
  }

  const n = expr();
  if (p < t.length) throw new Error(`مش فاهم "${t[p]}"`);
  return n;
}

export function evaluate(n: Node, x: number): number {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'x':
      return x;
    case 'neg':
      return -evaluate(n.a, x);
    case 'fn':
      return FNS[n.f]!(evaluate(n.a, x));
    case 'bin': {
      const a = evaluate(n.a, x);
      const b = evaluate(n.b, x);
      switch (n.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          return Math.pow(a, b);
      }
    }
  }
}

/** Compiles once; returns null and the error for an expression that doesn't parse. */
export function compile(src: string): { fn: ((x: number) => number) | null; error: string | null } {
  try {
    const n = parseExpression(src);
    return { fn: (x) => evaluate(n, x), error: null };
  } catch (e) {
    return { fn: null, error: e instanceof Error ? e.message : 'معادلة غلط' };
  }
}
