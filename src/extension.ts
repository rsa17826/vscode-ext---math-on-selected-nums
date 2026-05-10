import * as vscode from 'vscode';

// ─── Big-Number Math Library ──────────────────────────────────────────────────
// Ported from user-supplied JS to avoid floating-point errors.

function alignNums(num1: string, num2: string): [string, string] {
    const temp1 = num1.replace('-', '').split('.');
    const temp2 = num2.replace('-', '').split('.');

    const lenDiff = temp1[0].length - temp2[0].length;
    if (lenDiff > 0) {
        for (let i = 0; i < lenDiff; i++) temp2[0] = '0' + temp2[0];
    } else if (lenDiff < 0) {
        for (let i = 0; i < -lenDiff; i++) temp1[0] = '0' + temp1[0];
    }

    if (temp1.length === 1) temp1.push('0');
    if (temp2.length === 1) temp2.push('0');

    let t1dec = temp1.pop()!;
    let t2dec = temp2.pop()!;
    while (t2dec.length < t1dec.length) t2dec += '0';
    while (t1dec.length < t2dec.length) t1dec += '0';
    temp1.push(t1dec);
    temp2.push(t2dec);

    const r1 = (num1.startsWith('-') ? '-' : '') + temp1.join('.');
    const r2 = (num2.startsWith('-') ? '-' : '') + temp2.join('.');
    return [r1, r2];
}

function insertAtIndex(str: string, sub: string, idx: number): string {
    return str.slice(0, idx) + sub + str.slice(idx);
}

function addNums(num1: string, num2: string): string {
    const [n1, n2] = alignNums(num1, num2);
    let carry = 0;

    if (n1.startsWith('-') !== n2.startsWith('-')) {
        // Different signs → subtract absolute values (n1 - n2 conceptually)
        let borrowPos: number | false = false;
        const j1 = n1.replace('-', '').replace('.', '').split('').map(Number);
        const j2 = n2.replace('-', '').replace('.', '').split('').map(Number);
        const res: number[] = [...j1];
        let i = 0;
        while (true) {
            if (i === res.length) break;
            if (borrowPos !== false) {
                res[i] -= 1;
            } else {
                res[i] -= j2[i];
            }
            if (res[i] < 0) {
                if (borrowPos === false) borrowPos = i;
                res[i] += 10;
                i -= 1;
            } else {
                if (borrowPos !== false) i = borrowPos;
                borrowPos = false;
                i += 1;
            }
        }
        const dotIdx = n1.replace('-', '').indexOf('.');
        return insertAtIndex(res.join(''), '.', dotIdx);
    } else {
        // Same sign → add absolute values, then restore sign
        const negative = n1.startsWith('-');
        const temp1 = n1.replace('-', '').split('.').map(e => e.split('').reverse());
        const temp2 = n2.replace('-', '').split('.').map(e => e.split('').reverse());
        const result: string[][] = [[], []];
        for (let ii = 1; ii >= 0; ii--) {
            for (let i = 0; i < temp1[ii].length; i++) {
                const t = String(Number(temp1[ii][i]) + Number(temp2[ii][i]) + carry);
                result[ii].push(t[t.length - 1]);
                carry = t.length > 1 ? Number(t[0]) : 0;
            }
        }
        // Handle final carry in the integer part
        if (carry > 0) result[0].push(String(carry));
        const raw = result.map(e => e.reverse().join('')).join('.');
        return negative ? '-' + raw : raw;
    }
}

function subNums(num1: string, num2: string): string {
    if (num2.startsWith('-')) return addNums(num1, num2.slice(1));
    return addNums(num1, '-' + num2);
}

function multiplyNums(num1: string, num2: string): string {
    const neg1 = num1.startsWith('-');
    const neg2 = num2.startsWith('-');
    const resultNeg = neg1 !== neg2;
    const a = num1.replace(/^-/, '');
    const b = num2.replace(/^-/, '');

    const dec1 = (a.split('.')[1] ?? '').length;
    const dec2 = (b.split('.')[1] ?? '').length;
    const totalDec = dec1 + dec2;

    const int1 = a.replace('.', '');
    const int2 = b.replace('.', '');

    const res: number[] = new Array(int1.length + int2.length).fill(0);
    for (let i = int1.length - 1; i >= 0; i--) {
        for (let j = int2.length - 1; j >= 0; j--) {
            const mul = parseInt(int1[i]) * parseInt(int2[j]);
            const p2 = i + j + 1;
            const p1 = i + j;
            const sum = mul + res[p2];
            res[p2] = sum % 10;
            res[p1] += Math.floor(sum / 10);
        }
    }

    let str = res.join('');
    if (totalDec > 0) {
        while (str.length <= totalDec) str = '0' + str;
        str = str.slice(0, str.length - totalDec) + '.' + str.slice(str.length - totalDec);
    }
    str = str.replace(/^0+(?=\d)/, '') || '0';
    str = str.replace(/(\.\d*?)0+$/, '$1');
    str = str.replace(/\.$/, '');

    return resultNeg && str !== '0' ? '-' + str : str;
}

function divideNums(dividend: string, divisor: string, precision = 10): string {
    if (String(divisor).replace(/^-?0+/, '') === '' || divisor === '0') {
        throw new Error('Division by zero');
    }

    const negDiv = dividend.startsWith('-');
    const negDor = divisor.startsWith('-');
    const resultNeg = negDiv !== negDor;
    dividend = dividend.replace(/^-/, '');
    divisor  = divisor.replace(/^-/, '');

    function normalize(a: string, b: string): [string, string] {
        const aDec = (a.split('.')[1] ?? '').length;
        const bDec = (b.split('.')[1] ?? '').length;
        const shift = Math.max(aDec, bDec);
        const aInt = a.replace('.', '') + '0'.repeat(shift - aDec);
        const bInt = b.replace('.', '') + '0'.repeat(shift - bDec);
        return [aInt.replace(/^0+/, '') || '0', bInt.replace(/^0+/, '') || '0'];
    }

    function multiplyDigit(num: string, digit: number): string {
        let carry = 0, res = '';
        for (let i = num.length - 1; i >= 0; i--) {
            const prod = parseInt(num[i]) * digit + carry;
            res = (prod % 10) + res;
            carry = Math.floor(prod / 10);
        }
        if (carry > 0) res = carry + res;
        return res.replace(/^0+/, '') || '0';
    }

    function subtract(a: string, b: string): string {
        let carry = 0, res = '';
        const ar = a.split('').reverse();
        const br = b.split('').reverse();
        for (let i = 0; i < ar.length; i++) {
            let d = parseInt(ar[i]) - parseInt(br[i] ?? '0') - carry;
            if (d < 0) { d += 10; carry = 1; } else { carry = 0; }
            res = d + res;
        }
        return res.replace(/^0+/, '') || '0';
    }

    function compare(a: string, b: string): number {
        a = a.replace(/^0+/, '') || '0';
        b = b.replace(/^0+/, '') || '0';
        if (a.length !== b.length) return a.length - b.length;
        return a.localeCompare(b);
    }

    const [num, den] = normalize(dividend, divisor);
    let result = '', remainder = '';

    for (const digit of num) {
        remainder = (remainder + digit).replace(/^0+/, '') || '0';
        let q = 0;
        for (let d = 9; d >= 1; d--) {
            if (compare(remainder, multiplyDigit(den, d)) >= 0) {
                q = d;
                remainder = subtract(remainder, multiplyDigit(den, d));
                break;
            }
        }
        result += q;
    }

    if (precision > 0) {
        result += '.';
        for (let i = 0; i < precision; i++) {
            remainder = (remainder + '0').replace(/^0+/, '') || '0';
            let q = 0;
            for (let d = 9; d >= 1; d--) {
                if (compare(remainder, multiplyDigit(den, d)) >= 0) {
                    q = d;
                    remainder = subtract(remainder, multiplyDigit(den, d));
                    break;
                }
            }
            result += q;
        }
    }

    result = result.replace(/^0+(?=\d)/, '');
    result = result.replace(/(\.\d*?)0+$/, '$1');
    result = result.replace(/\.$/, '');
    if (!result) result = '0';

    return resultNeg && result !== '0' ? '-' + result : result;
}

/**
 * Raise base to an integer or fractional exponent.
 *   - Non-negative integer exponent → exact big-number repeated squaring.
 *   - Negative integer exponent     → 1 / base^|exp| (exact division).
 *   - Fractional exponent           → JS Math.pow (precision limited but unavoidable).
 */
function powerNums(base: string, exp: string): string {
    const expIsNegInt = /^-\d+$/.test(exp);
    const expIsPosInt = /^\d+$/.test(exp);

    if (expIsPosInt) {
        let n = parseInt(exp, 10);
        if (n === 0) return '1';
        let result = '1';
        let b = base;
        // Fast exponentiation by squaring (exact)
        while (n > 0) {
            if (n % 2 === 1) result = multiplyNums(result, b);
            b = multiplyNums(b, b);
            n = Math.floor(n / 2);
        }
        return result;
    }

    if (expIsNegInt) {
        // base^-n = 1 / base^n
        return divideNums('1', powerNums(base, exp.slice(1)));
    }

    // Fractional exponent — fall back to JS floating point
    const result = Math.pow(parseFloat(base), parseFloat(exp));
    return String(result);
}

// ─── Hex Utilities ────────────────────────────────────────────────────────────

/**
 * Detect whether to use uppercase or lowercase for hex output.
 * Rules:
 *   - Any upper + any lower  → 'upper' (mixed → default to upper)
 *   - All upper (or no letters) → 'upper'
 *   - All lower               → 'lower'
 */
function detectHexCase(hexStr: string): 'upper' | 'lower' {
    // Strip the 0x prefix and any digits; only look at A-F letters
    const letters = hexStr.replace(/^-?0x/i, '').replace(/[^a-fA-F]/g, '');
    if (!letters) return 'upper'; // no alpha hex digits → default upper
    const hasUpper = /[A-F]/.test(letters);
    const hasLower = /[a-f]/.test(letters);
    if (hasUpper && hasLower) return 'upper'; // mixed → default upper
    return hasUpper ? 'upper' : 'lower';
}

/** Convert a hex string (e.g. "0x0E" or "-0xFF") to a decimal string. */
function hexToDecStr(hex: string): string {
    const neg = hex.startsWith('-');
    const abs = neg ? hex.slice(1) : hex;
    const val = BigInt(abs); // BigInt handles 0x prefix natively
    return neg ? '-' + val.toString(10) : val.toString(10);
}

/** Convert a decimal result string back to a hex string with the given case. */
function decStrToHex(dec: string, caseStyle: 'upper' | 'lower'): string {
    // Round to nearest integer (hex literals are always integers)
    const neg = dec.startsWith('-');
    const absVal = parseFloat(neg ? dec.slice(1) : dec);
    const rounded = BigInt(Math.round(absVal));
    const h = rounded.toString(16);
    const hexDigits = caseStyle === 'upper' ? h.toUpperCase() : h.toLowerCase();
    return (neg ? '-' : '') + '0x' + hexDigits;
}

// ─── Expression Parser / Evaluator ───────────────────────────────────────────
// Grammar (with standard precedence):
//   expr   = term   (('+' | '-') term)*
//   term   = unary  (('*' | '/') unary)*
//   unary  = '-' unary | primary
//   primary = NUMBER | '(' expr ')'

type Token =
    | { type: 'num';    value: string }
    | { type: 'op';     value: string }
    | { type: 'lparen'              }
    | { type: 'rparen'              };

function tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < expr.length) {
        if (/\s/.test(expr[i])) { i++; continue; }
        if (expr[i] === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
        if (expr[i] === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
        if ('+-*/^'.includes(expr[i])) {
            // Check for ** before consuming a lone *
            if (expr[i] === '*' && expr[i + 1] === '*') {
                tokens.push({ type: 'op', value: '**' });
                i += 2;
            } else {
                tokens.push({ type: 'op', value: expr[i] });
                i++;
            }
            continue;
        }
        if (/\d/.test(expr[i])) {
            // Hex literal: 0x... or 0X...
            if (expr[i] === '0' && i + 1 < expr.length && /x/i.test(expr[i + 1])) {
                let num = '0x';
                i += 2;
                while (i < expr.length && /[0-9a-fA-F]/.test(expr[i])) num += expr[i++];
                // Convert hex → decimal string so the math library can handle it
                tokens.push({ type: 'num', value: hexToDecStr(num) });
                continue;
            }
            // Decimal / integer literal
            let num = '';
            while (i < expr.length && /[\d.]/.test(expr[i])) num += expr[i++];
            tokens.push({ type: 'num', value: num });
            continue;
        }
        throw new Error(`Unexpected character in expression: "${expr[i]}"`);
    }
    return tokens;
}

class ExprParser {
    private tokens: Token[];
    private pos = 0;

    constructor(tokens: Token[]) { this.tokens = tokens; }

    private peek(): Token | undefined { return this.tokens[this.pos]; }
    private consume(): Token { return this.tokens[this.pos++]; }

    parse(): string {
        const val = this.parseExpr();
        if (this.pos < this.tokens.length) throw new Error('Unexpected token after expression end');
        return val;
    }

    private parseExpr(): string {
        let left = this.parseTerm();
        while (true) {
            const t = this.peek();
            if (!t || t.type !== 'op' || (t.value !== '+' && t.value !== '-')) break;
            const op = (this.consume() as { type: 'op'; value: string }).value;
            const right = this.parseTerm();
            left = op === '+' ? addNums(left, right) : subNums(left, right);
        }
        return left;
    }

    private parseTerm(): string {
        let left = this.parsePower();
        while (true) {
            const t = this.peek();
            if (!t || t.type !== 'op' || (t.value !== '*' && t.value !== '/')) break;
            const op = (this.consume() as { type: 'op'; value: string }).value;
            const right = this.parsePower();
            left = op === '*' ? multiplyNums(left, right) : divideNums(left, right);
        }
        return left;
    }

    // Right-associative: 2**3**2 = 2**(3**2) = 512
    private parsePower(): string {
        const base = this.parseUnary();
        const t = this.peek();
        if (t && t.type === 'op' && (t.value === '**' || t.value === '^')) {
            this.consume();
            const exp = this.parsePower(); // right-recursive
            return powerNums(base, exp);
        }
        return base;
    }

    private parseUnary(): string {
        const t = this.peek();
        if (t && t.type === 'op' && (t as { type: 'op'; value: string }).value === '-') {
            this.consume();
            const val = this.parseUnary();
            // Negate: flip sign
            return val.startsWith('-') ? val.slice(1) : '-' + val;
        }
        return this.parsePrimary();
    }

    private parsePrimary(): string {
        const t = this.peek();
        if (!t) throw new Error('Unexpected end of expression');
        if (t.type === 'num') { this.consume(); return (t as { type: 'num'; value: string }).value; }
        if (t.type === 'lparen') {
            this.consume();
            const val = this.parseExpr();
            if (!this.peek() || this.peek()!.type !== 'rparen') throw new Error('Expected closing )');
            this.consume();
            return val;
        }
        throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
    }
}

/**
 * Evaluate the equation string with `$` substituted by `value`.
 * The value is wrapped in parens so negative values work safely.
 */
function evaluateExpr(equation: string, value: string): string {
    const substituted = equation.replace(/\$/g, `(${value})`);
    const tokens = tokenize(substituted);
    return new ExprParser(tokens).parse();
}

// ─── Number Processing ────────────────────────────────────────────────────────

// Matches hex first, then decimal (including decimals like 3.14).
// Does NOT match a leading minus (that's typically an operator in source code).
const NUMBER_RE = /0x[0-9a-fA-F]+|\d+(?:\.\d+)?/g;

interface Replacement {
    originalStartOffset: number;
    originalEndOffset: number;
    newText: string;
    range: vscode.Range;
}

function processNumber(numText: string, equation: string): string {
    const isHex = /^0x/i.test(numText);
    if (isHex) {
        const caseStyle = detectHexCase(numText);
        const dec = hexToDecStr(numText);
        const result = evaluateExpr(equation, dec);
        return decStrToHex(result, caseStyle);
    } else {
        return evaluateExpr(equation, numText);
    }
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
    const cmd = vscode.commands.registerCommand('mathOnSelections.run', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Math on Selections: No active editor.');
            return;
        }

        const selections = editor.selections;
        if (selections.length === 0 || selections.every(s => s.isEmpty)) {
            vscode.window.showErrorMessage('Math on Selections: Make a selection first.');
            return;
        }

        // ── Ask for equation ──────────────────────────────────────────────────
        const raw = await vscode.window.showInputBox({
            prompt: 'Equation  ($ = each number). No $ → prepended automatically.',
            placeHolder: '$/2   or   $*2+1   or   /3   or   +100',
            validateInput(val) {
                if (!val.trim()) return 'Please enter an equation.';
                return null;
            }
        });
        if (raw === undefined) return; // cancelled

        // If user didn't include $, prepend it (so "/2" → "$/2")
        const equation = raw.includes('$') ? raw : '$' + raw;

        // ── Collect all replacements ──────────────────────────────────────────
        const document = editor.document;
        const replacements: Replacement[] = [];
        const processedOffsets = new Set<number>(); // avoid duplicates from overlapping selections

        for (const selection of selections) {
            const selText = document.getText(selection);
            const selStartOffset = document.offsetAt(selection.start);

            NUMBER_RE.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = NUMBER_RE.exec(selText)) !== null) {
                const numText = match[0];
                const startOff = selStartOffset + match.index;
                const endOff   = startOff + numText.length;

                if (processedOffsets.has(startOff)) continue;
                processedOffsets.add(startOff);

                let newText: string;
                try {
                    newText = processNumber(numText, equation);
                } catch (err) {
                    vscode.window.showErrorMessage(
                        `Math on Selections: Error processing "${numText}": ${err}`
                    );
                    return;
                }

                replacements.push({
                    originalStartOffset: startOff,
                    originalEndOffset:   endOff,
                    newText,
                    range: new vscode.Range(
                        document.positionAt(startOff),
                        document.positionAt(endOff)
                    )
                });
            }
        }

        if (replacements.length === 0) {
            vscode.window.showInformationMessage('Math on Selections: No numbers found in selection(s).');
            return;
        }

        // Sort by document order (required for correct offset tracking after edits)
        replacements.sort((a, b) => a.originalStartOffset - b.originalStartOffset);

        // ── Apply all edits in one transaction ────────────────────────────────
        const success = await editor.edit(builder => {
            for (const rep of replacements) {
                builder.replace(rep.range, rep.newText);
            }
        });

        if (!success) {
            vscode.window.showErrorMessage('Math on Selections: Edit failed (document may have changed).');
            return;
        }

        // ── Update selections to highlight the newly placed numbers ───────────
        // After the edit the document is updated; use cumulative offset to find new positions.
        let cumulativeDelta = 0;
        const newSelections: vscode.Selection[] = [];

        for (const rep of replacements) {
            const newStart = rep.originalStartOffset + cumulativeDelta;
            const newEnd   = newStart + rep.newText.length;

            newSelections.push(new vscode.Selection(
                editor.document.positionAt(newStart),
                editor.document.positionAt(newEnd)
            ));

            cumulativeDelta += rep.newText.length - (rep.originalEndOffset - rep.originalStartOffset);
        }

        editor.selections = newSelections;
    });

    context.subscriptions.push(cmd);
}

export function deactivate(): void { /* nothing to clean up */ }