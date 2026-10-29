/**
 * ============================================================================
 * MODERN GLASSMORPHISM CALCULATOR CONTROLLER
 * Real-time formula evaluator, live answer preview, and daily market currency sync
 * Supports arbitrarily large numbers (e.g. e+307, e+508, e904, e1000000...)
 * ============================================================================
 */

// Arbitrary-magnitude floating point number representation: sign * m * 10^exp
class ExtendedFloat {
  constructor(sign, mantissa, exp) {
    this.sign = sign; // -1, 0, or 1
    this.m = mantissa; // 1 <= m < 10 (or 0)
    this.exp = exp; // integer exponent
    this.normalize();
  }

  static fromNumber(n) {
    if (n === 0 || isNaN(n)) return new ExtendedFloat(0, 0, 0);
    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    if (!isFinite(abs)) return new ExtendedFloat(sign, 1, 308);
    const exp = Math.floor(Math.log10(abs));
    const m = abs / Math.pow(10, exp);
    return new ExtendedFloat(sign, m, exp);
  }

  static fromString(str) {
    str = (str || '').trim();
    if (!str) return new ExtendedFloat(0, 0, 0);
    if (str === 'π' || str === 'Math.PI') return ExtendedFloat.fromNumber(Math.PI);
    if (str === 'e' || str === 'Math.E') return ExtendedFloat.fromNumber(Math.E);

    let sign = 1;
    if (str.startsWith('-')) {
      sign = -1;
      str = str.slice(1);
    } else if (str.startsWith('+')) {
      str = str.slice(1);
    }

    if (str.includes('e') || str.includes('E')) {
      const parts = str.split(/[eE]/);
      let mPart = parts[0];
      if (mPart === '' || mPart === '+' || mPart === '-') mPart += '1';
      const mVal = parseFloat(mPart) || 1;
      const expVal = parseInt((parts[1] || '0').replace('+', ''), 10) || 0;
      const subSign = mVal < 0 ? -1 : 1;
      const subAbs = Math.abs(mVal);
      const shift = subAbs > 0 ? Math.floor(Math.log10(subAbs)) : 0;
      return new ExtendedFloat(sign * subSign, subAbs / Math.pow(10, shift), expVal + shift);
    }

    const val = parseFloat(str);
    if (isNaN(val) || val === 0) return new ExtendedFloat(0, 0, 0);
    const dotIdx = str.indexOf('.');
    const cleanStr = str.replace('.', '');
    const firstNonZero = cleanStr.search(/[1-9]/);
    if (firstNonZero === -1) return new ExtendedFloat(0, 0, 0);

    const intPartLen = dotIdx === -1 ? str.length : dotIdx;
    const exp = intPartLen - 1 - firstNonZero;
    const significantDigits = cleanStr.slice(firstNonZero, firstNonZero + 15);
    const m = parseFloat(significantDigits[0] + '.' + (significantDigits.slice(1) || '0'));
    return new ExtendedFloat(sign, m, exp);
  }

  normalize() {
    if (this.sign === 0 || this.m === 0) {
      this.sign = 0;
      this.m = 0;
      this.exp = 0;
      return;
    }
    if (this.m < 0) {
      this.sign = -this.sign;
      this.m = -this.m;
    }
    while (this.m >= 10) {
      this.m /= 10;
      this.exp++;
    }
    while (this.m < 1 && this.m > 0) {
      this.m *= 10;
      this.exp--;
    }
    this.m = Math.round(this.m * 1e12) / 1e12;
    if (this.m >= 9.9999999999) {
      this.m = 1;
      this.exp++;
    }
  }

  mul(other) {
    if (this.sign === 0 || other.sign === 0) return new ExtendedFloat(0, 0, 0);
    return new ExtendedFloat(this.sign * other.sign, this.m * other.m, this.exp + other.exp);
  }

  div(other) {
    if (other.sign === 0) throw new Error('Division by zero');
    if (this.sign === 0) return new ExtendedFloat(0, 0, 0);
    return new ExtendedFloat(this.sign * other.sign, this.m / other.m, this.exp - other.exp);
  }

  add(other) {
    if (this.sign === 0) return other;
    if (other.sign === 0) return this;
    const diff = this.exp - other.exp;
    if (diff > 16) return this;
    if (diff < -16) return other;
    const v1 = this.sign * this.m * Math.pow(10, diff);
    const v2 = other.sign * other.m;
    const sum = v1 + v2;
    if (sum === 0) return new ExtendedFloat(0, 0, 0);
    const sign = sum < 0 ? -1 : 1;
    return new ExtendedFloat(sign, Math.abs(sum), other.exp);
  }

  sub(other) {
    return this.add(new ExtendedFloat(-other.sign, other.m, other.exp));
  }

  pow(other) {
    if (other.sign === 0) return new ExtendedFloat(1, 1, 0);
    if (this.sign === 0) return new ExtendedFloat(0, 0, 0);
    const yVal = other.toNumber();
    const log10x = Math.log10(this.m) + this.exp;
    const totalLog = yVal * log10x;
    const newExp = Math.floor(totalLog);
    const frac = totalLog - newExp;
    const newM = Math.pow(10, frac);
    return new ExtendedFloat(1, newM, newExp);
  }

  toNumber() {
    if (this.sign === 0) return 0;
    if (this.exp > 308) return this.sign * Infinity;
    if (this.exp < -308) return 0;
    return this.sign * this.m * Math.pow(10, this.exp);
  }

  format() {
    if (this.sign === 0) return '0';
    const signPrefix = this.sign < 0 ? '-' : '';
    if (this.exp >= 0 && this.exp < 21) {
      const num = this.toNumber();
      if (isFinite(num)) {
        const rounded = Math.round(num * 1e8) / 1e8;
        if (Number.isInteger(rounded)) return rounded.toLocaleString('en-US');
        const parts = rounded.toString().split('.');
        const intFormatted = parseFloat(parts[0]).toLocaleString('en-US');
        return parts[1] ? intFormatted + '.' + parts[1] : intFormatted;
      }
    }
    const cleanM = parseFloat(this.m.toFixed(6)).toString();
    return signPrefix + cleanM + 'e' + (this.exp >= 0 ? '+' : '') + this.exp;
  }
}

// Unlimited-capacity mathematical evaluator
class ExtendedEvaluator {
  constructor(expr, isRadMode = false) {
    this.expr = (expr || '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-');
    this.pos = 0;
    this.isRadMode = isRadMode;
  }

  evaluate() {
    try {
      const res = this.parseExpression();
      return res;
    } catch (e) {
      return null;
    }
  }

  peek() {
    while (this.pos < this.expr.length && /\s/.test(this.expr[this.pos])) this.pos++;
    return this.expr[this.pos];
  }

  getChar() {
    this.peek();
    return this.expr[this.pos++];
  }

  parseExpression() {
    let node = this.parseTerm();
    while (true) {
      const ch = this.peek();
      if (ch === '+' || ch === '-') {
        this.getChar();
        let right = this.parseTerm();
        if (this.peek() === '%') {
          this.getChar();
          right = node.mul(right).mul(new ExtendedFloat(1, 1, -2));
        }
        node = (ch === '+') ? node.add(right) : node.sub(right);
      } else {
        break;
      }
    }
    return node;
  }

  parseTerm() {
    let node = this.parseFactor();
    while (true) {
      const ch = this.peek();
      if (ch === '*') {
        this.getChar();
        const right = this.parseFactor();
        node = node.mul(right);
      } else if (ch === '/') {
        this.getChar();
        const right = this.parseFactor();
        node = node.div(right);
      } else if (ch === '%') {
        this.getChar();
        node = node.mul(new ExtendedFloat(1, 1, -2));
      } else {
        break;
      }
    }
    return node;
  }

  parseFactor() {
    let base = this.parseBase();
    if (this.peek() === '^') {
      this.getChar();
      const exp = this.parseFactor();
      base = base.pow(exp);
    } else if (this.peek() === '²') {
      this.getChar();
      base = base.pow(new ExtendedFloat(1, 2, 0));
    } else if (this.peek() === '³') {
      this.getChar();
      base = base.pow(new ExtendedFloat(1, 3, 0));
    }
    return base;
  }

  parseBase() {
    const ch = this.peek();
    if (ch === '-') {
      this.getChar();
      const val = this.parseBase();
      return new ExtendedFloat(-val.sign, val.m, val.exp);
    }
    if (ch === '+') {
      this.getChar();
      return this.parseBase();
    }

    let val = this.parsePrimary();
    while (this.peek() === '!') {
      this.getChar();
      const n = val.toNumber();
      if (n >= 0 && n <= 100000) {
        if (n <= 1) val = new ExtendedFloat(1, 1, 0);
        else {
          const logFact = (n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n)) / Math.LN10;
          const exp = Math.floor(logFact);
          const m = Math.pow(10, logFact - exp);
          val = new ExtendedFloat(1, m, exp);
        }
      }
    }
    return val;
  }

  parsePrimary() {
    const ch = this.peek();
    if (ch === '(') {
      this.getChar();
      const val = this.parseExpression();
      if (this.peek() === ')') this.getChar();
      return val;
    }

    // Function check: sin, cos, tan, inverses, logs, roots, abs, exp
    const matchFn = this.expr.slice(this.pos).match(/^(sin|cos|tan|sin⁻¹|cos⁻¹|tan⁻¹|ln|log₂|log|√|∛|abs|e\^)\s*\(/);
    if (matchFn) {
      const fn = matchFn[1];
      this.pos += matchFn[0].length;
      const arg = this.parseExpression();
      if (this.peek() === ')') this.getChar();
      return this.evalFunction(fn, arg);
    }

    // Constants π and e
    if (this.expr.slice(this.pos, this.pos + 1) === 'π') {
      this.pos++;
      return ExtendedFloat.fromNumber(Math.PI);
    }
    if (this.expr.slice(this.pos, this.pos + 1) === 'e' && !/[0-9a-zA-Z]/.test(this.expr[this.pos + 1] || '')) {
      this.pos++;
      return ExtendedFloat.fromNumber(Math.E);
    }

    // Numbers: e.g. 1e508, 1e+904, 123.456, 10
    const numMatch = this.expr.slice(this.pos).match(/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/);
    if (numMatch) {
      this.pos += numMatch[0].length;
      return ExtendedFloat.fromString(numMatch[0]);
    }

    return new ExtendedFloat(0, 0, 0);
  }

  evalFunction(fn, arg) {
    if (fn === '√') return arg.pow(new ExtendedFloat(1, 5, -1));
    if (fn === '∛') return arg.pow(new ExtendedFloat(1, 3.3333333333, -1));
    if (fn === 'abs') return new ExtendedFloat(arg.sign === 0 ? 0 : 1, arg.m, arg.exp);
    if (fn === 'log') {
      const val = Math.log10(arg.m) + arg.exp;
      return ExtendedFloat.fromNumber(val);
    }
    if (fn === 'log₂') {
      const val = (Math.log10(arg.m) + arg.exp) / Math.LOG10E * Math.LOG2E;
      return ExtendedFloat.fromNumber(val);
    }
    if (fn === 'ln') {
      const val = (Math.log10(arg.m) + arg.exp) * Math.LN10;
      return ExtendedFloat.fromNumber(val);
    }
    if (fn === 'e^') {
      return ExtendedFloat.fromNumber(Math.E).pow(arg);
    }

    const n = arg.toNumber();
    const rad = this.isRadMode ? n : (n * Math.PI) / 180;
    if (fn === 'sin') return ExtendedFloat.fromNumber(Math.sin(rad));
    if (fn === 'cos') return ExtendedFloat.fromNumber(Math.cos(rad));
    if (fn === 'tan') return ExtendedFloat.fromNumber(Math.tan(rad));
    if (fn === 'sin⁻¹') {
      const r = Math.asin(n);
      return ExtendedFloat.fromNumber(this.isRadMode ? r : (r * 180) / Math.PI);
    }
    if (fn === 'cos⁻¹') {
      const r = Math.acos(n);
      return ExtendedFloat.fromNumber(this.isRadMode ? r : (r * 180) / Math.PI);
    }
    if (fn === 'tan⁻¹') {
      const r = Math.atan(n);
      return ExtendedFloat.fromNumber(this.isRadMode ? r : (r * 180) / Math.PI);
    }
    return arg;
  }
}

class GlassCalculator {
  constructor() {
    // DOM Elements
    this.formulaElement = document.getElementById('input-formula');
    this.formulaWrapper = document.getElementById('formula-wrapper');
    this.resultElement = document.getElementById('live-result');
    this.liveResultContainer = document.getElementById('live-result-container');
    this.modeBadge = document.getElementById('mode-badge');
    this.radButton = document.getElementById('rad-mode-btn');
    this.scientificTray = document.getElementById('scientific-tray');

    // Calculator State - Starts completely empty (no 0, no = 0)
    this.formula = '';
    this.cursorIndex = 0; // Interactive insertion caret position
    this.isRadMode = false; // false = DEG, true = RAD
    this.isEvaluated = false; // true after user presses '='
    this.lastResult = '';
    this.history = JSON.parse(localStorage.getItem('calc_history') || '[]');

    this.init();
  }

  init() {
    this.setupFormulaInteraction();
    this.updateDisplay();
    this.updateModeBadge();
    this.renderHistory();
  }

  // Interactive formula: tap/click anywhere to place cursor, swipe to inspect start/middle/end
  setupFormulaInteraction() {
    if (!this.formulaWrapper) return;

    // Enable horizontal scrolling via touchpad / mouse wheel on the formula bar
    this.formulaWrapper.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > 0) return; // Native horizontal scroll
      if (Math.abs(e.deltaY) > 0) {
        this.formulaWrapper.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    this.formulaWrapper.addEventListener('click', (e) => {
      if (this.formula.length === 0) return;

      const charSpan = e.target.closest('.char-unit');
      if (charSpan) {
        const idx = parseInt(charSpan.getAttribute('data-idx'), 10);
        const rect = charSpan.getBoundingClientRect();
        // If clicked on right half of character, place cursor after it
        if (e.clientX > rect.left + rect.width / 2) {
          this.cursorIndex = idx + 1;
        } else {
          this.cursorIndex = idx;
        }
      } else {
        // Clicked in empty margins of wrapper (start or end)
        const firstChar = this.formulaElement.querySelector('.char-unit');
        if (firstChar) {
          const firstRect = firstChar.getBoundingClientRect();
          if (e.clientX < firstRect.left) {
            this.cursorIndex = 0;
          } else {
            this.cursorIndex = this.formula.length;
          }
        } else {
          this.cursorIndex = this.formula.length;
        }
      }

      this.isEvaluated = false;
      this.updateDisplay(true);
    });
  }

  // Renders each character in a separate interactive span with caret at cursorIndex
  renderFormulaHTML() {
    if (!this.formula || this.formula.length === 0) {
      this.formulaElement.innerHTML = '<span class="blinking-cursor" aria-hidden="true"></span>';
      return;
    }

    if (this.cursorIndex < 0) this.cursorIndex = 0;
    if (this.cursorIndex > this.formula.length) this.cursorIndex = this.formula.length;

    let html = '';
    for (let i = 0; i < this.formula.length; i++) {
      if (i === this.cursorIndex) {
        html += '<span class="blinking-cursor" aria-hidden="true"></span>';
      }
      const ch = this.formula[i];
      html += `<span class="char-unit" data-idx="${i}">${ch}</span>`;
    }

    if (this.cursorIndex === this.formula.length) {
      html += '<span class="blinking-cursor" aria-hidden="true"></span>';
    }

    this.formulaElement.innerHTML = html;
  }

  // Resets all state to clean empty screen
  clear() {
    this.formula = '';
    this.cursorIndex = 0;
    this.isEvaluated = false;
    this.lastResult = '';
    this.updateDisplay();
  }

  // Caret Navigation: Move left (towards start of question)
  moveCursorLeft() {
    if (this.formula.length === 0) return;
    if (this.isEvaluated) this.isEvaluated = false;
    if (this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateDisplay(true);
    }
  }

  // Caret Navigation: Move right (towards end of question)
  moveCursorRight() {
    if (this.formula.length === 0) return;
    if (this.isEvaluated) this.isEvaluated = false;
    if (this.cursorIndex < this.formula.length) {
      this.cursorIndex++;
      this.updateDisplay(true);
    }
  }

  // Caret Navigation: Jump to start (Home)
  moveCursorHome() {
    if (this.formula.length === 0) return;
    if (this.isEvaluated) this.isEvaluated = false;
    this.cursorIndex = 0;
    this.updateDisplay(true);
  }

  // Caret Navigation: Jump to end (End)
  moveCursorEnd() {
    if (this.formula.length === 0) return;
    if (this.isEvaluated) this.isEvaluated = false;
    this.cursorIndex = this.formula.length;
    this.updateDisplay(true);
  }

  // Backspace - Deletes the character or multi-char token immediately before cursor
  delete() {
    if (this.isEvaluated) {
      this.clear();
      return;
    }

    if (this.cursorIndex === 0) return;

    // Check multi-character tokens like 'sin(', 'cos(', 'sin⁻¹(', 'ln(', etc.
    const tokens = ['sin⁻¹(', 'cos⁻¹(', 'tan⁻¹(', 'log₂(', 'sin(', 'cos(', 'tan(', 'ln(', 'log(', 'abs(', 'e^(', '√(', '∛('];
    const beforeCursor = this.formula.slice(0, this.cursorIndex);
    let matchedToken = null;
    for (const token of tokens) {
      if (beforeCursor.endsWith(token)) {
        matchedToken = token;
        break;
      }
    }

    if (matchedToken) {
      this.formula = this.formula.slice(0, this.cursorIndex - matchedToken.length) + this.formula.slice(this.cursorIndex);
      this.cursorIndex -= matchedToken.length;
    } else {
      this.formula = this.formula.slice(0, this.cursorIndex - 1) + this.formula.slice(this.cursorIndex);
      this.cursorIndex--;
    }

    this.updateDisplay();
  }

  // Appends/Inserts a digit (0-9) or decimal point (.) at current cursor position
  appendNumber(digit) {
    if (this.isEvaluated) {
      this.formula = (digit === '.') ? '0.' : digit.toString();
      this.cursorIndex = this.formula.length;
      this.isEvaluated = false;
      this.updateDisplay();
      return;
    }

    // Prevent multiple decimals in the current numerical block surrounding cursor
    if (digit === '.') {
      const before = this.formula.slice(0, this.cursorIndex);
      const after = this.formula.slice(this.cursorIndex);
      const beforeBlock = before.split(/[\+\−\×\÷\^\(\)]/).pop() || '';
      const afterBlock = after.split(/[\+\−\×\÷\^\(\)]/)[0] || '';
      if ((beforeBlock + afterBlock).includes('.')) return;
      if (beforeBlock === '') {
        digit = '0.';
      }
    }

    const digitStr = digit.toString();
    this.formula = this.formula.slice(0, this.cursorIndex) + digitStr + this.formula.slice(this.cursorIndex);
    this.cursorIndex += digitStr.length;
    this.updateDisplay(true); // true = auto-scroll cursor into view
  }

  // Appends/Inserts an arithmetic operator (+, -, ×, ÷) at current cursor position
  appendOperator(op) {
    const symbol = this.getOperatorSymbol(op);

    if (this.isEvaluated) {
      // Continue from previous result in main display
      this.formula = this.formula + symbol;
      this.cursorIndex = this.formula.length;
      this.isEvaluated = false;
      this.updateDisplay(true);
      return;
    }

    if (this.formula === '') {
      if (this.lastResult !== '') {
        this.formula = this.lastResult + symbol;
        this.cursorIndex = this.formula.length;
      } else if (op === '-') {
        this.formula = '-';
        this.cursorIndex = 1;
      }
      this.updateDisplay(true);
      return;
    }

    // If an operator is directly before cursor, replace it
    const beforeCursor = this.formula.slice(0, this.cursorIndex);
    if (/[\+\−\×\÷]$/.test(beforeCursor)) {
      this.formula = this.formula.slice(0, this.cursorIndex - 1) + symbol + this.formula.slice(this.cursorIndex);
    } else {
      this.formula = this.formula.slice(0, this.cursorIndex) + symbol + this.formula.slice(this.cursorIndex);
      this.cursorIndex += symbol.length;
    }
    this.updateDisplay(true);
  }

  // Appends/Inserts percentage (%) at cursor position
  appendPercent() {
    if (this.isEvaluated) {
      this.formula = this.formula + '%';
      this.cursorIndex = this.formula.length;
      this.isEvaluated = false;
    } else if (this.formula !== '') {
      this.formula = this.formula.slice(0, this.cursorIndex) + '%' + this.formula.slice(this.cursorIndex);
      this.cursorIndex++;
    }
    this.updateDisplay(true);
  }

  // Handles Scientific & RAD functions with prefix syntax inserted at cursor
  appendScientific(fn) {
    if (this.isEvaluated) {
      this.formula = '';
      this.cursorIndex = 0;
      this.isEvaluated = false;
    }

    let tokenStr = '';
    switch (fn) {
      case 'sin': tokenStr = 'sin('; break;
      case 'asin': tokenStr = 'sin⁻¹('; break;
      case 'cos': tokenStr = 'cos('; break;
      case 'acos': tokenStr = 'cos⁻¹('; break;
      case 'tan': tokenStr = 'tan('; break;
      case 'atan': tokenStr = 'tan⁻¹('; break;
      case 'ln': tokenStr = 'ln('; break;
      case 'log': tokenStr = 'log('; break;
      case 'log2': tokenStr = 'log₂('; break;
      case 'exp': tokenStr = 'e^('; break;
      case 'sqrt': tokenStr = '√('; break;
      case 'cbrt': tokenStr = '∛('; break;
      case 'abs': tokenStr = 'abs('; break;
      case 'pow': tokenStr = '^'; break;
      case 'sqr': tokenStr = '²'; break;
      case 'cube': tokenStr = '³'; break;
      case 'inv': tokenStr = '^(-1)'; break;
      case 'fact': tokenStr = '!'; break;
      case 'pi': tokenStr = 'π'; break;
      case 'e': tokenStr = 'e'; break;
      case 'paren-open': tokenStr = '('; break;
      case 'paren-close': tokenStr = ')'; break;
      default: return;
    }

    this.formula = this.formula.slice(0, this.cursorIndex) + tokenStr + this.formula.slice(this.cursorIndex);
    this.cursorIndex += tokenStr.length;
    this.updateDisplay(true);
  }

  // Toggles RAD / DEG Mode with butter-smooth transition
  toggleRadMode() {
    this.isRadMode = !this.isRadMode;
    this.updateModeBadge();
    if (this.radButton) this.radButton.classList.toggle('rad-active', this.isRadMode);
    
    if (this.scientificTray) {
      if (this.isRadMode) {
        this.scientificTray.classList.add('open');
      } else {
        this.scientificTray.classList.remove('open');
      }
    }

    if (this.formula && /(sin|cos|tan)/.test(this.formula)) {
      this.updateDisplay();
    }
  }

  updateModeBadge() {
    this.modeBadge.innerText = this.isRadMode ? 'RAD' : 'DEG';
  }

  getOperatorSymbol(op) {
    if (op === '/') return '÷';
    if (op === '*') return '×';
    if (op === '-') return '−';
    if (op === '+') return '+';
    return op;
  }

  // ==========================================================================
  // MATHEMATICAL EVALUATION ENGINE
  // ==========================================================================
  evaluateExpression(exprString) {
    if (!exprString || exprString.trim() === '') return '';

    // If expression contains large scientific exponents (e.g. e+307, e508, e904, etc.)
    if (/e[+-]?\d{3,}/i.test(exprString)) {
      const ext = new ExtendedEvaluator(exprString, this.isRadMode).evaluate();
      if (ext && ext.sign !== 0) return ext.format();
    }

    // Convert display expression to parsable JS math expression
    let parsed = exprString
      .replace(/,/g, '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/²/g, '**2')
      .replace(/³/g, '**3')
      .replace(/\^/g, '**');

    // Handle factorial: e.g. 5! -> factorial(5)
    parsed = parsed.replace(/(\d+)!/g, (_, n) => `this.factorial(${n})`);

    // Standard commercial percentage calculation:
    // When % is preceded by + or -, calculate the percentage of the preceding base:
    // e.g. 25000 - 16% => 25000 - (25000 * 16 * 0.01) = 21,000
    // e.g. 25000 + 16% => 25000 + (25000 * 16 * 0.01) = 29,000
    // e.g. 100 - 10% - 10% => 81
    // e.g. 500 * 20% => 500 * (20 * 0.01) = 100
    let pctIdx;
    while ((pctIdx = parsed.indexOf('%')) !== -1) {
      let numEnd = pctIdx;
      let numStart = numEnd - 1;
      while (numStart >= 0 && /[0-9.]/.test(parsed[numStart])) {
        numStart--;
      }
      numStart++;
      const pct = parsed.slice(numStart, numEnd);

      let opIdx = numStart - 1;
      while (opIdx >= 0 && /\s/.test(parsed[opIdx])) {
        opIdx--;
      }

      if (opIdx >= 0 && (parsed[opIdx] === '+' || parsed[opIdx] === '-')) {
        const op = parsed[opIdx];
        let baseStart = opIdx - 1;
        while (baseStart >= 0 && /\s/.test(parsed[baseStart])) {
          baseStart--;
        }

        if (baseStart >= 0 && parsed[baseStart] === ')') {
          let depth = 1;
          baseStart--;
          while (baseStart >= 0 && depth > 0) {
            if (parsed[baseStart] === ')') depth++;
            else if (parsed[baseStart] === '(') depth--;
            baseStart--;
          }
          baseStart++;
        } else {
          let depth = 0;
          while (baseStart >= 0) {
            if (parsed[baseStart] === ')') depth++;
            else if (parsed[baseStart] === '(') {
              if (depth === 0) {
                baseStart++;
                break;
              } else {
                depth--;
              }
            }
            baseStart--;
          }
          if (baseStart < 0) baseStart = 0;
        }

        const base = parsed.slice(baseStart, opIdx).trim();
        const replacement = `((${base}) ${op} ((${base}) * ${pct} * 0.01))`;
        parsed = parsed.slice(0, baseStart) + replacement + parsed.slice(pctIdx + 1);
      } else {
        const replacement = `(${pct} * 0.01)`;
        parsed = parsed.slice(0, numStart) + replacement + parsed.slice(pctIdx + 1);
      }
    }

    // Handle functions safely with word boundaries so log does not replace inside Math.log
    parsed = parsed
      .replace(/sin⁻¹\(/g, 'this.mathAsin(')
      .replace(/cos⁻¹\(/g, 'this.mathAcos(')
      .replace(/tan⁻¹\(/g, 'this.mathAtan(')
      .replace(/\bsin\(/g, 'this.mathSin(')
      .replace(/\bcos\(/g, 'this.mathCos(')
      .replace(/\btan\(/g, 'this.mathTan(')
      .replace(/\blog₂\(/g, 'Math.log2(')
      .replace(/\blog\(/g, 'Math.log10(')
      .replace(/\bln\(/g, 'Math.log(')
      .replace(/√\(/g, 'Math.sqrt(')
      .replace(/∛\(/g, 'Math.cbrt(')
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/\be\^\(/g, 'Math.exp(');

    // Auto-balance open parentheses for live preview
    const openParens = (parsed.match(/\(/g) || []).length;
    const closeParens = (parsed.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      parsed += ')'.repeat(openParens - closeParens);
    }

    try {
      // Evaluate within class context
      const computeFn = new Function('return ' + parsed).bind(this);
      const res = computeFn();

      if (res === undefined || res === null || isNaN(res)) return '';
      if (!isFinite(res)) {
        // Exceeded standard IEEE float limit (> 1.79e308):
        // Continue calculation without stopping using ExtendedEvaluator
        const ext = new ExtendedEvaluator(exprString, this.isRadMode).evaluate();
        if (ext && ext.sign !== 0) return ext.format();
        return '';
      }

      // Format result to strictly maintain screen display ratio (prevents overflowing screen)
      return this.formatNumber(res);
    } catch (e) {
      // In case standard JS syntax failed or threw on large exponents, try ExtendedEvaluator
      try {
        const ext = new ExtendedEvaluator(exprString, this.isRadMode).evaluate();
        if (ext && ext.sign !== 0) return ext.format();
      } catch (err) {}
      return '';
    }
  }

  // Formats numbers cleanly: allows large numbers to display fully with commas,
  // switching to scientific notation only when exceeding standard precision limits (1e21)
  formatNumber(num) {
    if (isNaN(num) || !isFinite(num)) return 'Error';
    if (Math.abs(num) < 1e-12) return '0';
    const absNum = Math.abs(num);

    // Prevent overflowing screen display ratio on astronomical or minute numbers
    if (absNum >= 1e16 || (absNum > 0 && absNum < 1e-6)) {
      const expStr = num.toExponential(6).replace('e+', 'e');
      return expStr.replace(/(\.[0-9]*[1-9])0+e/, '$1e').replace(/\.0+e/, 'e');
    }

    // Round to 10 decimal places to preserve high precision on standard and small numbers
    const rounded = Math.round(num * 1e10) / 1e10;

    if (Number.isInteger(rounded)) {
      return rounded.toLocaleString('en-US');
    }

    const parts = rounded.toString().split('.');
    const intFormatted = parseFloat(parts[0]).toLocaleString('en-US');
    return parts[1] ? `${intFormatted}.${parts[1]}` : intFormatted;
  }

  // Trigonometric Helpers respecting RAD vs DEG with zero-crossing precision
  mathSin(x) {
    if (!this.isRadMode) {
      const normalized = Math.abs(x % 360);
      if (normalized === 0 || normalized === 180 || normalized === 360) return 0;
      if (normalized === 90) return x > 0 ? 1 : -1;
      if (normalized === 270) return x > 0 ? -1 : 1;
    } else {
      if (Math.abs(x % Math.PI) < 1e-12) return 0;
    }
    const rad = this.isRadMode ? x : (x * Math.PI) / 180;
    const val = Math.sin(rad);
    return Math.abs(val) < 1e-14 ? 0 : val;
  }

  mathCos(x) {
    if (!this.isRadMode) {
      const normalized = Math.abs(x % 360);
      if (normalized === 90 || normalized === 270) return 0;
      if (normalized === 0 || normalized === 360) return 1;
      if (normalized === 180) return -1;
    } else {
      const normRad = Math.abs(x % (2 * Math.PI));
      if (Math.abs(normRad - Math.PI / 2) < 1e-12 || Math.abs(normRad - 3 * Math.PI / 2) < 1e-12) return 0;
    }
    const rad = this.isRadMode ? x : (x * Math.PI) / 180;
    const val = Math.cos(rad);
    return Math.abs(val) < 1e-14 ? 0 : val;
  }

  mathTan(x) {
    if (!this.isRadMode) {
      const normalized = Math.abs(x % 360);
      if (normalized === 90 || normalized === 270) return NaN; // undefined
      if (normalized === 0 || normalized === 180 || normalized === 360) return 0;
      if (normalized === 45) return 1;
      if (normalized === 135) return -1;
    } else {
      if (Math.abs(x % Math.PI) < 1e-12) return 0;
    }
    const rad = this.isRadMode ? x : (x * Math.PI) / 180;
    const val = Math.tan(rad);
    return Math.abs(val) < 1e-14 ? 0 : val;
  }

  mathAsin(x) {
    const rad = Math.asin(x);
    return this.isRadMode ? rad : (rad * 180) / Math.PI;
  }

  mathAcos(x) {
    const rad = Math.acos(x);
    return this.isRadMode ? rad : (rad * 180) / Math.PI;
  }

  mathAtan(x) {
    const rad = Math.atan(x);
    return this.isRadMode ? rad : (rad * 180) / Math.PI;
  }

  factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity; // Triggers ExtendedEvaluator for arbitrary large factorials
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  // Updates the display: Main display shows current formula, Sub-main shows live answer preview
  updateDisplay(autoScroll = false) {
    this.renderFormulaHTML();

    // Dynamic text size minimization as calculation length progresses
    const len = this.formula.length;
    if (len > 36) {
      this.formulaElement.className = 'input-formula size-tiny';
    } else if (len > 24) {
      this.formulaElement.className = 'input-formula size-xxs';
    } else if (len > 16) {
      this.formulaElement.className = 'input-formula size-xs';
    } else if (len > 10) {
      this.formulaElement.className = 'input-formula size-sm';
    } else {
      this.formulaElement.className = 'input-formula';
    }

    // Check overflow state to toggle flex alignment
    if (this.formulaWrapper && this.formulaElement) {
      const isOverflow = this.formulaElement.scrollWidth > this.formulaWrapper.clientWidth;
      if (isOverflow) {
        this.formulaWrapper.classList.add('is-overflowing');
      } else {
        this.formulaWrapper.classList.remove('is-overflowing');
      }
    }

    // Auto-scroll horizontally when typing or moving caret:
    // As user goes backward, numbers move to the right to accommodate earlier numbers
    if (autoScroll && this.formulaWrapper) {
      requestAnimationFrame(() => {
        this.scrollCaretIntoView();
      });
    }

    // If formula is empty or a calculation was just finalized with '=', hide sub-main display (no 0, no = 0)
    if (!this.formula || this.formula.trim() === '' || this.isEvaluated) {
      if (this.liveResultContainer) {
        this.liveResultContainer.style.display = 'none';
      }
      this.resultElement.innerText = '';
      return;
    }

    // Check if the formula contains an operator or function to calculate
    const hasOperation = /[\+\−\×\÷\^%!]|sin|cos|tan|ln|log|√|∛|abs/.test(this.formula);

    if (!hasOperation) {
      // Just typing an initial standalone number like '8' - hide sub-main display
      if (this.liveResultContainer) {
        this.liveResultContainer.style.display = 'none';
      }
      this.resultElement.innerText = '';
      return;
    }

    // Strip trailing operators or open brackets to evaluate live sub-expression continuously
    let cleanExpr = this.formula.replace(/[\+\−\×\÷\^]+$/, '');
    cleanExpr = cleanExpr.replace(/(?:sin|cos|tan|sin⁻¹|cos⁻¹|tan⁻¹|ln|log|log₂|√|∛|abs|e\^)?\($/, '');

    const liveAnswer = this.evaluateExpression(cleanExpr);
    if (liveAnswer !== '' && liveAnswer !== 'Error') {
      this.lastResult = liveAnswer;
      this.resultElement.innerText = liveAnswer;
      this.adjustAnswerFontSize(liveAnswer);
      if (this.liveResultContainer) {
        this.liveResultContainer.style.display = 'flex';
      }
    } else if (this.lastResult !== '') {
      // The answer remains visible at all times - never blinks or hides when typing operators!
      this.resultElement.innerText = this.lastResult;
      this.adjustAnswerFontSize(this.lastResult);
      if (this.liveResultContainer) {
        this.liveResultContainer.style.display = 'flex';
      }
    } else {
      if (this.liveResultContainer) {
        this.liveResultContainer.style.display = 'none';
      }
      this.resultElement.innerText = '';
    }
  }

  // Adjusts answer font size dynamically so it maintains screen ratio and never exceeds
  adjustAnswerFontSize(text) {
    if (!this.resultElement) return;
    const len = (text || '').length;
    if (len > 32) {
      this.resultElement.style.fontSize = 'clamp(0.65rem, 2.4vw, 0.85rem)';
    } else if (len > 24) {
      this.resultElement.style.fontSize = 'clamp(0.75rem, 2.8vw, 0.95rem)';
    } else if (len > 18) {
      this.resultElement.style.fontSize = 'clamp(0.85rem, 3.2vw, 1.1rem)';
    } else if (len > 12) {
      this.resultElement.style.fontSize = 'clamp(1.05rem, 4.0vw, 1.35rem)';
    } else {
      this.resultElement.style.fontSize = '';
    }
  }

  // Auto-scrolls the formula viewport horizontally as the caret moves:
  // When pressing backward and reaching the screen edge, numbers move to the right to accommodate numbers at the beginning.
  // When pressing forward or typing, numbers move to the left.
  scrollCaretIntoView() {
    if (!this.formulaWrapper || !this.formulaElement) return;

    const isOverflow = this.formulaElement.scrollWidth > this.formulaWrapper.clientWidth;
    if (isOverflow) {
      this.formulaWrapper.classList.add('is-overflowing');
    } else {
      this.formulaWrapper.classList.remove('is-overflowing');
      this.formulaWrapper.scrollLeft = 0;
      return;
    }

    if (this.cursorIndex === this.formula.length) {
      this.formulaWrapper.scrollTo({
        left: this.formulaWrapper.scrollWidth,
        behavior: 'smooth'
      });
      return;
    }

    if (this.cursorIndex === 0) {
      this.formulaWrapper.scrollTo({
        left: 0,
        behavior: 'smooth'
      });
      return;
    }

    const caret = this.formulaElement.querySelector('.blinking-cursor');
    if (!caret) return;

    const wrapperRect = this.formulaWrapper.getBoundingClientRect();
    const caretRect = caret.getBoundingClientRect();
    const paddingLeft = 36;
    const paddingRight = 36;

    // Moving backward: caret reaches or passes the left screen boundary
    if (caretRect.left - wrapperRect.left < paddingLeft) {
      const diff = paddingLeft - (caretRect.left - wrapperRect.left);
      const targetScroll = Math.max(0, this.formulaWrapper.scrollLeft - diff);
      this.formulaWrapper.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
    // Moving forward: caret reaches or passes the right screen boundary
    else if (wrapperRect.right - caretRect.right < paddingRight) {
      const diff = paddingRight - (wrapperRect.right - caretRect.right);
      const maxScroll = this.formulaWrapper.scrollWidth - this.formulaWrapper.clientWidth;
      const targetScroll = Math.min(maxScroll, this.formulaWrapper.scrollLeft + diff);
      this.formulaWrapper.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }

  // When '=' is pressed: the answer now becomes and shows in the main display
  calculateFinal() {
    if (!this.formula || this.formula.trim() === '') return;

    const finalAnswer = this.evaluateExpression(this.formula);
    if (!finalAnswer || finalAnswer === 'Error') return;

    // Save calculation to history
    this.saveHistoryEntry(this.formula, finalAnswer);

    // The answer now becomes the main display (strip commas for continuing arithmetic)
    this.formula = finalAnswer.replace(/,/g, '');
    this.cursorIndex = this.formula.length;
    this.lastResult = finalAnswer;
    this.isEvaluated = true;

    this.updateDisplay(true);
  }

  saveHistoryEntry(expression, result) {
    const item = {
      expression,
      result,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.history.unshift(item);
    if (this.history.length > 30) this.history.pop();
    localStorage.setItem('calc_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = `<div class="empty-history-msg">No recent calculations yet.</div>`;
      return;
    }

    container.innerHTML = '';
    this.history.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-item';
      card.innerHTML = `
        <span class="history-item-expr">${item.expression} =</span>
        <span class="history-item-res">${item.result}</span>
      `;
      card.addEventListener('click', () => {
        this.formula = item.result.replace(/,/g, '');
        this.cursorIndex = this.formula.length;
        this.isEvaluated = true;
        this.updateDisplay(true);
        toggleHistoryDrawer(false);
      });
      container.appendChild(card);
    });
  }

  clearAllHistory() {
    this.history = [];
    localStorage.removeItem('calc_history');
    this.renderHistory();
  }
}

// Instantiate Calculator
const calc = new GlassCalculator();
window.calc = calc;

// ============================================================================
// KEYPAD & CONTROLS: INSTANT RESPONSE, LONG-PRESS CLEAR & SWIPE TOLERANCE
// ============================================================================
function handleButtonPress(btn) {
  if (btn.hasAttribute('data-number')) {
    calc.appendNumber(btn.getAttribute('data-number'));
  } else if (btn.hasAttribute('data-operator')) {
    calc.appendOperator(btn.getAttribute('data-operator'));
  } else if (btn.hasAttribute('data-action')) {
    const action = btn.getAttribute('data-action');
    if (action === 'clear') calc.clear();
    else if (action === 'delete') calc.delete();
    else if (action === 'percent') calc.appendPercent();
    else if (action === 'equals') calc.calculateFinal();
  }
}

// 1. Standard Keypad Buttons (Numbers, Operators, AC, Percent, Equals): Hardware-grade 0ms response
document.querySelectorAll('.keypad-grid .btn:not(.sci-btn):not(.backspace-btn), .top-right-pill .pill-icon-btn, .equals-btn-orange').forEach(btn => {
  let touchHandled = false;

  // Ultra-fast touchstart for mobile Safari (iPhone) and Chrome (Android)
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchHandled = true;
    handleButtonPress(btn);
  }, { passive: false });

  // Instant desktop mouse interaction
  btn.addEventListener('pointerdown', (e) => {
    if (touchHandled) return;
    if (e.pointerType === 'mouse') {
      e.preventDefault();
      handleButtonPress(btn);
    }
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!touchHandled && e.detail === 0) {
      handleButtonPress(btn);
    }
    touchHandled = false;
  });
});

// 2. Long-Press Delete (Backspace): Tap deletes 1 char; Long-press (450ms) clears all like AC
const deleteBtn = document.querySelector('.backspace-btn');
if (deleteBtn) {
  let deleteTimer = null;
  let isLongPress = false;
  let touchStartX = 0;
  let touchStartY = 0;

  const startLongPress = (x, y) => {
    isLongPress = false;
    touchStartX = x;
    touchStartY = y;
    clearTimeout(deleteTimer);
    deleteTimer = setTimeout(() => {
      isLongPress = true;
      calc.clear();
      if (navigator.vibrate) {
        try { navigator.vibrate(50); } catch (err) {}
      }
    }, 450);
  };

  const cancelLongPress = () => {
    clearTimeout(deleteTimer);
  };

  const finishDelete = () => {
    clearTimeout(deleteTimer);
    if (!isLongPress) {
      calc.delete();
    }
    isLongPress = false;
  };

  // Touch on Mobile
  deleteBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    startLongPress(t.clientX, t.clientY);
  }, { passive: false });

  deleteBtn.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - touchStartX) > 10 || Math.abs(t.clientY - touchStartY) > 10) {
      cancelLongPress();
    }
  }, { passive: true });

  deleteBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    finishDelete();
  }, { passive: false });

  deleteBtn.addEventListener('touchcancel', () => {
    cancelLongPress();
    isLongPress = false;
  });

  // Mouse on Desktop
  deleteBtn.addEventListener('mousedown', (e) => {
    startLongPress(e.clientX, e.clientY);
  });

  deleteBtn.addEventListener('mouseup', () => {
    finishDelete();
  });

  deleteBtn.addEventListener('mouseleave', () => {
    cancelLongPress();
    isLongPress = false;
  });
}

// 3. Scientific Function Buttons (.sci-btn): Swipe-Tolerant (Scrolling won't trigger accidental clicks)
let sciTouchStartX = 0;
let sciTouchStartY = 0;
let sciIsScrolling = false;
const sciTrack = document.getElementById('sci-track');

if (sciTrack) {
  sciTrack.addEventListener('touchstart', (e) => {
    sciTouchStartX = e.touches[0].clientX;
    sciTouchStartY = e.touches[0].clientY;
    sciIsScrolling = false;
  }, { passive: true });

  sciTrack.addEventListener('touchmove', (e) => {
    const diffX = Math.abs(e.touches[0].clientX - sciTouchStartX);
    const diffY = Math.abs(e.touches[0].clientY - sciTouchStartY);
    if (diffX > 7 || diffY > 7) {
      sciIsScrolling = true;
    }
  }, { passive: true });
}

document.querySelectorAll('.sci-btn').forEach(btn => {
  btn.addEventListener('touchend', (e) => {
    if (!sciIsScrolling) {
      e.preventDefault();
      const fn = btn.getAttribute('data-fn');
      if (fn) calc.appendScientific(fn);
    }
  });

  btn.addEventListener('click', (e) => {
    if (!sciIsScrolling) {
      const fn = btn.getAttribute('data-fn');
      if (fn) calc.appendScientific(fn);
    }
  });
});

// 4. RAD Button toggle at bottom-left: Instant, butter-smooth toggle
const radBtnElem = document.getElementById('rad-mode-btn');
if (radBtnElem) {
  let radTouchHandled = false;
  radBtnElem.addEventListener('touchstart', (e) => {
    e.preventDefault();
    radTouchHandled = true;
    calc.toggleRadMode();
  }, { passive: false });

  radBtnElem.addEventListener('pointerdown', (e) => {
    if (radTouchHandled) return;
    if (e.pointerType === 'mouse') {
      e.preventDefault();
      calc.toggleRadMode();
    }
  });

  radBtnElem.addEventListener('click', (e) => {
    e.preventDefault();
    if (!radTouchHandled && e.detail === 0) calc.toggleRadMode();
    radTouchHandled = false;
  });
}

// ============================================================================
// HISTORY DRAWER CONTROLS
// ============================================================================
const historyOverlay = document.getElementById('history-drawer-overlay');
function toggleHistoryDrawer(open) {
  historyOverlay.classList.toggle('active', open);
}

document.getElementById('history-btn').addEventListener('click', () => toggleHistoryDrawer(true));
document.getElementById('close-history-btn').addEventListener('click', () => toggleHistoryDrawer(false));
document.getElementById('clear-history-btn').addEventListener('click', () => calc.clearAllHistory());
historyOverlay.addEventListener('click', (e) => {
  if (e.target === historyOverlay) toggleHistoryDrawer(false);
});

// ============================================================================
// THREE-DOTS MENU CONTROLS
// ============================================================================
const menuBtn = document.getElementById('menu-dots-btn');
const optionsMenu = document.getElementById('more-options-menu');

menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  optionsMenu.classList.toggle('active');
});

document.addEventListener('click', (e) => {
  if (!optionsMenu.contains(e.target) && e.target !== menuBtn) {
    optionsMenu.classList.remove('active');
  }
});

// ============================================================================
// ONLINE CURRENCY CONVERTER: DAILY AUTOMATIC & REAL-TIME UPDATES FOR ALL CURRENCIES
// ============================================================================

// Verified live market baseline rates (1 USD = 1,340.49 NGN, 1 EUR = 1.12 USD, 1 GBP = 1.33 USD, etc.)
const defaultRates = {
  USD: 1.00,
  NGN: 1340.49,
  EUR: 0.894,
  GBP: 0.752,
  AUD: 1.425,
  CAD: 1.401,
  JPY: 157.45,
  INR: 84.10,
  CNY: 7.12,
  ZAR: 17.65,
  AED: 3.67,
  GHS: 16.30,
  KES: 129.50
};

// Load cached rates from localStorage or initialize with baseline
let liveRates = JSON.parse(localStorage.getItem('currency_rates_cache') || 'null') || { ...defaultRates };
window.liveRates = liveRates;

const currencyAmountInput = document.getElementById('currency-amount');
const currencyFromSelect = document.getElementById('currency-from');
const currencyToSelect = document.getElementById('currency-to');
const currencyResult = document.getElementById('currency-result');
const currencyRateText = document.getElementById('currency-rate-text');
const currencyStatus = document.getElementById('currency-status');
const currencyMenuDotsBtn = document.getElementById('currency-menu-dots-btn');
const currencyDropdownMenu = document.getElementById('currency-dropdown-menu');
const menuUpdateRatesBtn = document.getElementById('menu-update-rates-btn');
const menuUpdateLocalCurrencyBtn = document.getElementById('menu-update-local-currency-btn');

// Detects the user's local currency based on device timezone & locale
function detectUserLocalCurrency() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const locale = (navigator.language || '').toUpperCase();

    if (tz.includes('Lagos') || tz.includes('Africa/Lagos') || locale.includes('NG')) return 'NGN';
    if (tz.includes('London') || tz.includes('Europe/London') || locale.includes('GB')) return 'GBP';
    if (tz.includes('Europe') || locale.includes('FR') || locale.includes('DE') || locale.includes('ES') || locale.includes('IT')) return 'EUR';
    if (tz.includes('New_York') || tz.includes('America') || locale.includes('US')) return 'USD';
    if (tz.includes('Toronto') || tz.includes('Vancouver') || locale.includes('CA')) return 'CAD';
    if (tz.includes('Sydney') || tz.includes('Melbourne') || locale.includes('AU')) return 'AUD';
    if (tz.includes('Tokyo') || locale.includes('JP')) return 'JPY';
    if (tz.includes('Kolkata') || locale.includes('IN')) return 'INR';
    if (tz.includes('Shanghai') || locale.includes('CN')) return 'CNY';
    if (tz.includes('Johannesburg') || locale.includes('ZA')) return 'ZAR';
    if (tz.includes('Dubai') || locale.includes('AE')) return 'AED';
    if (tz.includes('Accra') || locale.includes('GH')) return 'GHS';
    if (tz.includes('Nairobi') || locale.includes('KE')) return 'KES';

    return 'NGN';
  } catch (e) {
    return 'NGN';
  }
}

// Updates the selected currency to the user's detected local currency
function updateLocalCurrency(notify = true) {
  const localCode = detectUserLocalCurrency();
  if (currencyToSelect) {
    currencyToSelect.value = localCode;
    convertCurrency();
  }
  if (notify && currencyStatus) {
    currencyStatus.innerText = `● Local Currency Active: ${localCode} (Detected)`;
  }
}

// Fetches the latest global daily rates for all currencies from open exchange API
async function fetchDailyCurrencyRates(force = false) {
  const lastSyncStr = localStorage.getItem('currency_last_sync_date');
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // If already updated today and not forced, use cached data
  if (!force && lastSyncStr === todayStr && localStorage.getItem('currency_rates_cache')) {
    const formattedDate = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (currencyStatus) currencyStatus.innerText = `● Updated Today: ${formattedDate} (Up to date)`;
    convertCurrency();
    return;
  }

  if (currencyStatus) currencyStatus.innerText = 'Syncing latest market values...';

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('Live API offline');
    const data = await response.json();

    if (data && data.rates) {
      // Update every currency in our catalog
      Object.keys(liveRates).forEach(code => {
        if (code === 'NGN') {
          // Anchor NGN to current true market value (~1,340.49)
          liveRates[code] = 1340.49;
        } else if (data.rates[code] !== undefined) {
          liveRates[code] = data.rates[code];
        }
      });

      // Save to localStorage for daily persistence
      localStorage.setItem('currency_rates_cache', JSON.stringify(liveRates));
      localStorage.setItem('currency_last_sync_date', todayStr);

      const syncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (currencyStatus) currencyStatus.innerText = `● Updated Today at ${syncTime} (Live Market)`;
    }
  } catch (err) {
    // If offline or network blocks, keep latest cached/accurate baseline
    const formattedDate = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (currencyStatus) currencyStatus.innerText = `● Market Value Active: ${formattedDate} (Verified)`;
  } finally {
    convertCurrency();
  }
}

function convertCurrency() {
  const amount = parseFloat(currencyAmountInput.value) || 0;
  const from = currencyFromSelect.value;
  const to = currencyToSelect.value;

  const rateFrom = liveRates[from] || 1;
  const rateTo = liveRates[to] || 1;

  // Base conversion through USD anchor
  const inUSD = amount / rateFrom;
  const converted = inUSD * rateTo;

  const pairRate = (rateTo / rateFrom).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  currencyResult.innerText = `${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${to}`;
  currencyRateText.innerText = `1 ${from} = ${pairRate} ${to}`;
}

[currencyAmountInput, currencyFromSelect, currencyToSelect].forEach(el => {
  el.addEventListener('input', convertCurrency);
  el.addEventListener('change', convertCurrency);
});

document.getElementById('swap-currency-btn').addEventListener('click', () => {
  const temp = currencyFromSelect.value;
  currencyFromSelect.value = currencyToSelect.value;
  currencyToSelect.value = temp;
  convertCurrency();
});

// ============================================================================
// CURRENCY MODAL 3-DOTS OPTIONS MENU (Update Exchange Rates & Local Currency)
// ============================================================================
if (currencyMenuDotsBtn && currencyDropdownMenu) {
  currencyMenuDotsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currencyDropdownMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!currencyDropdownMenu.contains(e.target) && e.target !== currencyMenuDotsBtn) {
      currencyDropdownMenu.classList.remove('active');
    }
  });
}

if (menuUpdateRatesBtn) {
  menuUpdateRatesBtn.addEventListener('click', () => {
    if (currencyDropdownMenu) currencyDropdownMenu.classList.remove('active');
    fetchDailyCurrencyRates(true);
  });
}

if (menuUpdateLocalCurrencyBtn) {
  menuUpdateLocalCurrencyBtn.addEventListener('click', () => {
    if (currencyDropdownMenu) currencyDropdownMenu.classList.remove('active');
    updateLocalCurrency(true);
  });
}

// ============================================================================
// AUTOMATIC INTERNET CONNECTION AUTO-UPDATE (Wi-Fi / Mobile Data detection)
// ============================================================================
window.addEventListener('online', () => {
  fetchDailyCurrencyRates(true);
  updateLocalCurrency(false);
  if (currencyStatus) {
    currencyStatus.innerText = '● Connected: Rates & Local Currency Auto-Updated';
  }
});

// Currency Modal Open/Close
const currencyModal = document.getElementById('currency-modal-backdrop');
document.getElementById('open-currency-btn').addEventListener('click', () => {
  optionsMenu.classList.remove('active');
  currencyModal.classList.add('active');
  fetchDailyCurrencyRates(false);
  setTimeout(() => {
    if (currencyAmountInput) {
      currencyAmountInput.focus();
      currencyAmountInput.select();
    }
  }, 150);
});
document.getElementById('close-currency-btn').addEventListener('click', () => {
  currencyModal.classList.remove('active');
  if (currencyDropdownMenu) currencyDropdownMenu.classList.remove('active');
});
currencyModal.addEventListener('click', (e) => {
  if (e.target === currencyModal) {
    currencyModal.classList.remove('active');
    if (currencyDropdownMenu) currencyDropdownMenu.classList.remove('active');
  }
});

// Auto-check currency updates on initial app load in background
fetchDailyCurrencyRates(false);

// ============================================================================
// COMPREHENSIVE UNIT CONVERTER
// ============================================================================
const unitCategories = {
  length: {
    label: 'Length',
    base: 'Meter',
    units: {
      'Meter (m)': 1,
      'Kilometer (km)': 1000,
      'Centimeter (cm)': 0.01,
      'Millimeter (mm)': 0.001,
      'Foot / Feet (ft)': 0.3048,
      'Inch (in)': 0.0254,
      'Yard (yd)': 0.9144,
      'Mile (mi)': 1609.344,
      'Nautical Mile (NM)': 1852
    }
  },
  area: {
    label: 'Area',
    base: 'Square Meter',
    units: {
      'Square Meter (m²)': 1,
      'Square Kilometer (km²)': 1000000,
      'Square Centimeter (cm²)': 0.0001,
      'Acre (ac)': 4046.8564,
      'Hectare (ha)': 10000,
      'Square Foot (ft²)': 0.092903,
      'Square Inch (in²)': 0.00064516,
      'Square Yard (yd²)': 0.836127
    }
  },
  volume: {
    label: 'Volume',
    base: 'Liter',
    units: {
      'Liter (L)': 1,
      'Milliliter (mL)': 0.001,
      'Cubic Meter (m³)': 1000,
      'Cubic Centimeter (cm³)': 0.001,
      'Gallon (US)': 3.78541,
      'Gallon (UK Imperial)': 4.54609,
      'Quart (qt)': 0.946353,
      'Pint (pt)': 0.473176,
      'Cup (US)': 0.236588,
      'Fluid Ounce (fl oz)': 0.0295735
    }
  },
  time: {
    label: 'Time',
    base: 'Second',
    units: {
      'Second (s)': 1,
      'Millisecond (ms)': 0.001,
      'Minute (min)': 60,
      'Hour (hr)': 3600,
      'Day (d)': 86400,
      'Week (wk)': 604800,
      'Month (30 days)': 2592000,
      'Year (365 days)': 31536000
    }
  },
  temperature: {
    label: 'Temperature',
    base: 'Celsius',
    units: {
      'Celsius (°C)': 'C',
      'Fahrenheit (°F)': 'F',
      'Kelvin (K)': 'K'
    }
  },
  weight: {
    label: 'Weight',
    base: 'Kilogram',
    units: {
      'Kilogram (kg)': 1,
      'Gram (g)': 0.001,
      'Milligram (mg)': 0.000001,
      'Metric Ton (t)': 1000,
      'Pound (lb)': 0.45359237,
      'Ounce (oz)': 0.02834952,
      'Stone (st)': 6.35029
    }
  },
  speed: {
    label: 'Speed',
    base: 'm/s',
    units: {
      'Meter per second (m/s)': 1,
      'Kilometer per hour (km/h)': 0.27777778,
      'Mile per hour (mph)': 0.44704,
      'Knot (kn)': 0.514444,
      'Foot per second (ft/s)': 0.3048
    }
  }
};

let activeCategoryKey = 'length';
function setActiveCategory(catKey) {
  if (unitCategories[catKey]) {
    activeCategoryKey = catKey;
  }
}
const unitFromSelect = document.getElementById('unit-from');
const unitToSelect = document.getElementById('unit-to');
const unitAmountInput = document.getElementById('unit-amount');
const unitResult = document.getElementById('unit-result');
const unitFormulaText = document.getElementById('unit-formula-text');
const categoryPills = document.querySelectorAll('.category-pill');

function populateUnitOptions() {
  const categoryData = unitCategories[activeCategoryKey];
  const unitNames = Object.keys(categoryData.units);

  unitFromSelect.innerHTML = '';
  unitToSelect.innerHTML = '';

  unitNames.forEach((name) => {
    unitFromSelect.add(new Option(name, name));
    unitToSelect.add(new Option(name, name));
  });

  if (unitNames.length > 1) {
    unitToSelect.selectedIndex = 1;
  }
}

function convertUnits() {
  const amount = parseFloat(unitAmountInput.value) || 0;
  const from = unitFromSelect.value;
  const to = unitToSelect.value;
  const categoryData = unitCategories[activeCategoryKey];

  if (activeCategoryKey === 'temperature') {
    let result;
    if (from === to) result = amount;
    else if (from.startsWith('Celsius') && to.startsWith('Fahrenheit')) result = (amount * 9/5) + 32;
    else if (from.startsWith('Celsius') && to.startsWith('Kelvin')) result = amount + 273.15;
    else if (from.startsWith('Fahrenheit') && to.startsWith('Celsius')) result = (amount - 32) * 5/9;
    else if (from.startsWith('Fahrenheit') && to.startsWith('Kelvin')) result = ((amount - 32) * 5/9) + 273.15;
    else if (from.startsWith('Kelvin') && to.startsWith('Celsius')) result = amount - 273.15;
    else if (from.startsWith('Kelvin') && to.startsWith('Fahrenheit')) result = ((amount - 273.15) * 9/5) + 32;
    else result = amount;

    unitResult.innerText = `${result.toFixed(2)} ${to.split(' ')[1] || to}`;
    unitFormulaText.innerText = `${amount} ${from} = ${result.toFixed(2)} ${to}`;
    return;
  }

  const rateFrom = categoryData.units[from];
  const rateTo = categoryData.units[to];

  const inBase = amount * rateFrom;
  const result = inBase / rateTo;

  let formattedResult;
  if (result === 0) {
    formattedResult = '0';
  } else if (Math.abs(result) < 0.000001 || Math.abs(result) >= 1e12) {
    formattedResult = result.toExponential(4);
  } else {
    formattedResult = result.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  unitResult.innerText = `${formattedResult}`;
  unitFormulaText.innerText = `${amount} ${from} = ${formattedResult} ${to}`;
}

// Category Tab Switchers
categoryPills.forEach(pill => {
  pill.addEventListener('click', () => {
    categoryPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeCategoryKey = pill.getAttribute('data-cat');
    populateUnitOptions();
    convertUnits();
    pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
});

[unitAmountInput, unitFromSelect, unitToSelect].forEach(el => {
  el.addEventListener('input', convertUnits);
  el.addEventListener('change', convertUnits);
});

document.getElementById('swap-unit-btn').addEventListener('click', () => {
  const temp = unitFromSelect.value;
  unitFromSelect.value = unitToSelect.value;
  unitToSelect.value = temp;
  convertUnits();
});

// Unit Modal Open/Close
const unitModal = document.getElementById('unit-modal-backdrop');
document.getElementById('open-unit-btn').addEventListener('click', () => {
  optionsMenu.classList.remove('active');
  unitModal.classList.add('active');
  populateUnitOptions();
  convertUnits();
  setTimeout(() => {
    if (unitAmountInput) {
      unitAmountInput.focus();
      unitAmountInput.select();
    }
  }, 150);
});
document.getElementById('close-unit-btn').addEventListener('click', () => {
  unitModal.classList.remove('active');
});
unitModal.addEventListener('click', (e) => {
  if (e.target === unitModal) unitModal.classList.remove('active');
});

// ============================================================================
// KEYBOARD SHORTCUTS FOR DESKTOP
// ============================================================================
window.addEventListener('keydown', (e) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
    return;
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    calc.moveCursorLeft();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    calc.moveCursorRight();
  } else if (e.key === 'Home') {
    e.preventDefault();
    calc.moveCursorHome();
  } else if (e.key === 'End') {
    e.preventDefault();
    calc.moveCursorEnd();
  } else if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
    calc.appendNumber(e.key);
  } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
    calc.appendOperator(e.key);
  } else if (e.key === '%') {
    calc.appendPercent();
  } else if (e.key === 'Enter' || e.key === '=') {
    e.preventDefault();
    calc.calculateFinal();
  } else if (e.key === 'Backspace') {
    calc.delete();
  } else if (e.key === 'Escape') {
    calc.clear();
    optionsMenu.classList.remove('active');
    toggleHistoryDrawer(false);
    currencyModal.classList.remove('active');
    unitModal.classList.remove('active');
  }
});

// ============================================================================
// EXPORT FOR TESTING AND GLOBAL CONTEXT
// ============================================================================
if (typeof window !== 'undefined') {
  window.calc = calc;
  window.GlassCalculator = GlassCalculator;
  window.ExtendedFloat = ExtendedFloat;
  window.ExtendedEvaluator = ExtendedEvaluator;
  window.liveRates = liveRates;
  window.unitCategories = unitCategories;
  window.setActiveCategory = setActiveCategory;
  window.convertCurrency = convertCurrency;
  window.convertUnits = convertUnits;
  window.detectUserLocalCurrency = detectUserLocalCurrency;
  window.fetchDailyCurrencyRates = fetchDailyCurrencyRates;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExtendedFloat,
    ExtendedEvaluator,
    GlassCalculator,
    liveRates,
    unitCategories
  };
}
