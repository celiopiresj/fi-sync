// Tiny arithmetic evaluator for the amount field — supports `+ - * /` and
// parentheses over numbers (comma or period as the decimal separator), no
// `eval`/`Function`. Returns `null` for anything that isn't a valid
// expression so callers can fall back to treating the input as a plain
// number.

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (char === " " || char === "\t") {
      i++;
      continue;
    }

    if ("+-*/".includes(char)) {
      tokens.push({ type: "op", value: char as "+" | "-" | "*" | "/" });
      i++;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      i++;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let raw = "";
      while (i < input.length && /[0-9.,]/.test(input[i])) {
        raw += input[i];
        i++;
      }
      const value = Number(raw.replace(",", "."));
      if (Number.isNaN(value)) return null;
      tokens.push({ type: "number", value });
      continue;
    }

    // Unknown character — not a valid expression.
    return null;
  }

  return tokens;
}

// Recursive-descent parser: expr -> term (('+' | '-') term)*
//                            term -> factor (('*' | '/') factor)*
//                            factor -> number | '(' expr ')' | '-' factor
class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek() {
    return this.tokens[this.pos];
  }

  private next() {
    return this.tokens[this.pos++];
  }

  parseExpression(): number | null {
    let value = this.parseTerm();
    if (value === null) return null;

    while (this.peek()?.type === "op" && (this.peek() as Token & { type: "op" }).value !== "*" && (this.peek() as Token & { type: "op" }).value !== "/") {
      const op = this.next() as Token & { type: "op" };
      const rhs = this.parseTerm();
      if (rhs === null) return null;
      value = op.value === "+" ? value + rhs : value - rhs;
    }

    return value;
  }

  private parseTerm(): number | null {
    let value = this.parseFactor();
    if (value === null) return null;

    while (
      this.peek()?.type === "op" &&
      ((this.peek() as Token & { type: "op" }).value === "*" ||
        (this.peek() as Token & { type: "op" }).value === "/")
    ) {
      const op = this.next() as Token & { type: "op" };
      const rhs = this.parseFactor();
      if (rhs === null) return null;
      if (op.value === "/" && rhs === 0) return null;
      value = op.value === "*" ? value * rhs : value / rhs;
    }

    return value;
  }

  private parseFactor(): number | null {
    const token = this.peek();
    if (!token) return null;

    if (token.type === "op" && token.value === "-") {
      this.next();
      const value = this.parseFactor();
      return value === null ? null : -value;
    }

    if (token.type === "op" && token.value === "+") {
      this.next();
      return this.parseFactor();
    }

    if (token.type === "number") {
      this.next();
      return token.value;
    }

    if (token.type === "paren" && token.value === "(") {
      this.next();
      const value = this.parseExpression();
      if (value === null) return null;
      const closing = this.next();
      if (!closing || closing.type !== "paren" || closing.value !== ")") {
        return null;
      }
      return value;
    }

    return null;
  }

  isAtEnd() {
    return this.pos >= this.tokens.length;
  }
}

// Returns the numeric result, or `null` if `input` isn't a valid
// arithmetic expression (including plain numbers with no operators —
// callers should try this first and fall back to a plain numeric coerce).
export function evaluateExpression(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return null;

  const parser = new Parser(tokens);
  const result = parser.parseExpression();
  if (result === null || !parser.isAtEnd() || !Number.isFinite(result)) {
    return null;
  }

  return result;
}

// True only when the input actually uses an operator (so callers can
// decide whether to show a "= R$ X" preview — a plain "120" shouldn't
// trigger it, but "120+35" should).
export function isCompoundExpression(input: string): boolean {
  return /[+\-*/]/.test(input.trim().replace(/^-/, ""));
}
