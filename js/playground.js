/* ============================================
   PyMaster - Interactive Code Playground
   Robust Python-in-JS simulator
   Handles: print, variables, f-strings, for/while,
   if/elif/else, functions, lists, basic operations
   ============================================ */

function initPlayground() {
    const editor = document.getElementById('playground-editor');
    const outputEl = document.getElementById('playground-output');
    const runBtn = document.getElementById('run-btn');
    const clearBtn = document.getElementById('clear-btn');

    if (!editor || !runBtn) return;

    runBtn.addEventListener('click', () => {
        const code = editor.value;
        outputEl.textContent = '';
        try {
            const result = runPython(code);
            if (result.length === 0) {
                outputEl.textContent = '✅ Code executed (no output)';
            } else {
                outputEl.textContent = result.join('\n');
            }
        } catch (err) {
            outputEl.textContent = '❌ Error: ' + err.message;
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            editor.value = '';
            outputEl.textContent = '# Output will appear here...';
        });
    }

    // Tab key support
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const s = editor.selectionStart, en = editor.selectionEnd;
            editor.value = editor.value.substring(0, s) + '    ' + editor.value.substring(en);
            editor.selectionStart = editor.selectionEnd = s + 4;
        }
    });
}

/* ===== PYTHON INTERPRETER ===== */
function runPython(code) {
    const output = [];
    const vars = {};
    const funcs = {};

    // Built-in functions available to expressions
    const builtins = {
        len: (x) => { if (typeof x === 'string' || Array.isArray(x)) return x.length; if (typeof x === 'object') return Object.keys(x).length; return 0; },
        int: (x) => parseInt(x, 10),
        float: (x) => parseFloat(x),
        str: (x) => String(x),
        abs: (x) => Math.abs(x),
        max: (...a) => { const flat = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return Math.max(...flat); },
        min: (...a) => { const flat = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return Math.min(...flat); },
        sum: (arr) => arr.reduce((a, b) => a + b, 0),
        range: (...args) => { let start = 0, stop, step = 1; if (args.length === 1) { stop = args[0]; } else if (args.length === 2) { start = args[0]; stop = args[1]; } else { start = args[0]; stop = args[1]; step = args[2]; } const r = []; if (step > 0) { for (let i = start; i < stop; i += step)r.push(i); } else { for (let i = start; i > stop; i += step)r.push(i); } return r; },
        type: (x) => { if (x === null || x === undefined) return "<class 'NoneType'>"; if (typeof x === 'number') return Number.isInteger(x) ? "<class 'int'>" : "<class 'float'>"; if (typeof x === 'string') return "<class 'str'>"; if (typeof x === 'boolean') return "<class 'bool'>"; if (Array.isArray(x)) return "<class 'list'>"; return "<class 'object'>"; },
        round: (x, d) => d !== undefined ? Number(x.toFixed(d)) : Math.round(x),
        sorted: (arr, key, rev) => { const copy = [...arr]; copy.sort((a, b) => a - b); return rev ? copy.reverse() : copy; },
        reversed: (arr) => [...arr].reverse(),
        list: (x) => Array.isArray(x) ? [...x] : typeof x === 'string' ? x.split('') : [...x],
        set: (arr) => [...new Set(arr)],
        enumerate: (arr, start) => { start = start || 0; return arr.map((v, i) => [i + start, v]); },
        zip: (...arrs) => { const minLen = Math.min(...arrs.map(a => a.length)); const r = []; for (let i = 0; i < minLen; i++) { r.push(arrs.map(a => a[i])); } return r; },
        isinstance: (obj, t) => typeof obj === t,
        print: (...args) => { /* handled separately */ },
        input: (prompt) => { return window.prompt(prompt || '') || ''; },
        bool: (x) => !!x,
        chr: (x) => String.fromCharCode(x),
        ord: (x) => x.charCodeAt(0),
        hex: (x) => '0x' + x.toString(16),
        bin: (x) => '0b' + x.toString(2),
        oct: (x) => '0o' + x.toString(8),
        pow: (a, b) => Math.pow(a, b),
        divmod: (a, b) => [Math.floor(a / b), a % b],
    };

    const lines = code.split('\n');
    executeBlock(lines, 0, lines.length, vars, funcs, builtins, output, 0);
    return output;
}

function executeBlock(lines, start, end, vars, funcs, builtins, output, depth) {
    let i = start;
    let loopCount = 0;
    const MAX_LOOPS = 50000;

    while (i < end) {
        if (++loopCount > MAX_LOOPS) { output.push('⚠️ Execution limit reached'); return; }

        let raw = lines[i];
        let line = raw.trimEnd();
        let indent = line.length - line.trimStart().length;
        line = line.trim();

        // Skip empty / comments
        if (!line || line.startsWith('#')) { i++; continue; }

        // --- def --- function definition
        if (line.startsWith('def ') && line.endsWith(':')) {
            const m = line.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:/);
            if (m) {
                const fname = m[1], params = m[2].split(',').map(p => p.trim()).filter(Boolean);
                const bodyStart = i + 1;
                const bodyEnd = findBlockEnd(lines, i, indent);
                funcs[fname] = { params, bodyStart, bodyEnd, lines };
                i = bodyEnd;
                continue;
            }
        }

        // --- for loop ---
        if (line.startsWith('for ') && line.includes(' in ') && line.endsWith(':')) {
            const m = line.match(/^for\s+(.+?)\s+in\s+(.+)\s*:$/);
            if (m) {
                const loopVar = m[1].trim();
                const iterExpr = m[2].trim();
                const bodyStart = i + 1;
                const bodyEnd = findBlockEnd(lines, i, indent);
                let iterable = evalExpr(iterExpr, vars, funcs, builtins, output);
                if (typeof iterable === 'string') iterable = iterable.split('');
                if (iterable && typeof iterable[Symbol.iterator] === 'function') {
                    iterable = [...iterable];
                }
                if (Array.isArray(iterable)) {
                    for (const val of iterable) {
                        // handle tuple unpacking: for i, v in enumerate(...)
                        if (loopVar.includes(',')) {
                            const varNames = loopVar.split(',').map(s => s.trim());
                            if (Array.isArray(val)) {
                                varNames.forEach((n, idx) => vars[n] = val[idx] !== undefined ? val[idx] : null);
                            } else {
                                vars[varNames[0]] = val;
                            }
                        } else {
                            vars[loopVar] = val;
                        }
                        executeBlock(lines, bodyStart, bodyEnd, vars, funcs, builtins, output, depth + 1);
                    }
                }
                i = bodyEnd;
                continue;
            }
        }

        // --- while loop ---
        if (line.startsWith('while ') && line.endsWith(':')) {
            const cond = line.slice(6, -1).trim();
            const bodyStart = i + 1;
            const bodyEnd = findBlockEnd(lines, i, indent);
            let whileGuard = 0;
            while (evalExpr(cond, vars, funcs, builtins, output)) {
                if (++whileGuard > MAX_LOOPS) { output.push('⚠️ Infinite loop detected'); break; }
                executeBlock(lines, bodyStart, bodyEnd, vars, funcs, builtins, output, depth + 1);
            }
            i = bodyEnd;
            continue;
        }

        // --- if / elif / else ---
        if (line.startsWith('if ') && line.endsWith(':')) {
            i = handleIfBlock(lines, i, indent, vars, funcs, builtins, output, depth);
            continue;
        }

        // --- print() ---
        if (line.startsWith('print(') && line.endsWith(')')) {
            handlePrint(line, vars, funcs, builtins, output);
            i++; continue;
        }

        // --- variable assignment ---
        const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*([+\-*\/]?=)\s*(.+)$/);
        if (assignMatch && !line.includes('==')) {
            const vname = assignMatch[1];
            const op = assignMatch[2];
            const valStr = assignMatch[3].trim();
            const val = evalExpr(valStr, vars, funcs, builtins, output);
            if (op === '=') vars[vname] = val;
            else if (op === '+=') vars[vname] = (vars[vname] || 0) + val;
            else if (op === '-=') vars[vname] = (vars[vname] || 0) - val;
            else if (op === '*=') vars[vname] = (vars[vname] || 0) * val;
            else if (op === '/=') vars[vname] = (vars[vname] || 0) / val;
            i++; continue;
        }

        // --- tuple unpacking: a, b = ...
        const unpackMatch = line.match(/^([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)+)\s*=\s*(.+)$/);
        if (unpackMatch) {
            const varNames = unpackMatch[1].split(',').map(s => s.trim());
            const valStr = unpackMatch[2].trim();
            const val = evalExpr(valStr, vars, funcs, builtins, output);
            if (Array.isArray(val)) {
                varNames.forEach((n, idx) => vars[n] = val[idx] !== undefined ? val[idx] : null);
            } else {
                // a, b = b, a style — evaluate RHS comma-separated
                const parts = splitTopLevel(valStr, ',');
                if (parts.length === varNames.length) {
                    const evaluated = parts.map(p => evalExpr(p.trim(), vars, funcs, builtins, output));
                    varNames.forEach((n, idx) => vars[n] = evaluated[idx]);
                }
            }
            i++; continue;
        }

        // --- standalone expression (function call etc) ---
        evalExpr(line, vars, funcs, builtins, output);
        i++;
    }
}

/* ===== IF BLOCK HANDLER ===== */
function handleIfBlock(lines, i, baseIndent, vars, funcs, builtins, output, depth) {
    let line = lines[i].trim();
    const condStr = line.slice(3, -1).trim();
    const bodyStart = i + 1;
    const bodyEnd = findBlockEnd(lines, i, baseIndent);
    let executed = false;

    if (evalExpr(condStr, vars, funcs, builtins, output)) {
        executeBlock(lines, bodyStart, bodyEnd, vars, funcs, builtins, output, depth + 1);
        executed = true;
    }

    i = bodyEnd;

    // handle elif / else
    while (i < lines.length) {
        const nextLine = lines[i].trim();
        const nextIndent = lines[i].length - lines[i].trimStart().length;
        if (nextIndent !== baseIndent) break;

        if (nextLine.startsWith('elif ') && nextLine.endsWith(':')) {
            const elifCond = nextLine.slice(5, -1).trim();
            const elifBodyStart = i + 1;
            const elifBodyEnd = findBlockEnd(lines, i, baseIndent);
            if (!executed && evalExpr(elifCond, vars, funcs, builtins, output)) {
                executeBlock(lines, elifBodyStart, elifBodyEnd, vars, funcs, builtins, output, depth + 1);
                executed = true;
            }
            i = elifBodyEnd;
        } else if (nextLine === 'else:') {
            const elseBodyStart = i + 1;
            const elseBodyEnd = findBlockEnd(lines, i, baseIndent);
            if (!executed) {
                executeBlock(lines, elseBodyStart, elseBodyEnd, vars, funcs, builtins, output, depth + 1);
            }
            i = elseBodyEnd;
        } else {
            break;
        }
    }
    return i;
}

/* ===== FIND END OF INDENTED BLOCK ===== */
function findBlockEnd(lines, headerLine, headerIndent) {
    let i = headerLine + 1;
    while (i < lines.length) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (!trimmed || trimmed.startsWith('#')) { i++; continue; }
        const ind = raw.length - raw.trimStart().length;
        if (ind <= headerIndent) break;
        i++;
    }
    return i;
}

/* ===== PRINT HANDLER ===== */
function handlePrint(line, vars, funcs, builtins, output) {
    // Extract everything inside print(...)
    let inner = line.slice(6, -1);

    // Handle end= and sep= kwargs
    let endChar = '\n';
    let sepChar = ' ';
    const endMatch = inner.match(/,\s*end\s*=\s*("[^"]*"|'[^']*')\s*$/);
    if (endMatch) {
        endChar = endMatch[1].slice(1, -1);
        inner = inner.slice(0, inner.lastIndexOf(',', inner.indexOf('end=') - 1));
    }
    const sepMatch = inner.match(/,\s*sep\s*=\s*("[^"]*"|'[^']*')\s*$/);
    if (sepMatch) {
        sepChar = sepMatch[1].slice(1, -1);
        inner = inner.slice(0, inner.lastIndexOf(',', inner.indexOf('sep=') - 1));
    }

    if (inner.trim() === '') {
        output.push('');
        return;
    }

    // Split by top-level commas
    const parts = splitTopLevel(inner, ',');
    const values = parts.map(p => {
        const val = evalExpr(p.trim(), vars, funcs, builtins, output);
        return formatValue(val, false);
    });

    const text = values.join(sepChar);
    if (endChar === '\n') {
        output.push(text);
    } else {
        // Append to last line or create new
        if (output.length > 0 && !output._lastWasNewline) {
            output[output.length - 1] += text + endChar;
        } else {
            output.push(text + endChar);
        }
        output._lastWasNewline = false;
        return;
    }
    output._lastWasNewline = true;
}

/* ===== FORMAT VALUE FOR DISPLAY ===== */
function formatValue(val, inRepr) {
    if (val === null || val === undefined) return 'None';
    if (val === true) return 'True';
    if (val === false) return 'False';
    if (Array.isArray(val)) return '[' + val.map(v => formatValue(v, true)).join(', ') + ']';
    if (typeof val === 'object' && !Array.isArray(val)) {
        const entries = Object.entries(val).map(([k, v]) => formatValue(k, true) + ': ' + formatValue(v, true));
        return '{' + entries.join(', ') + '}';
    }
    if (typeof val === 'string') return inRepr ? `'${val}'` : val;
    return String(val);
}

/* ===== EXPRESSION EVALUATOR ===== */
function evalExpr(expr, vars, funcs, builtins, output) {
    expr = expr.trim();
    if (!expr) return undefined;

    // None, True, False
    if (expr === 'None') return null;
    if (expr === 'True') return true;
    if (expr === 'False') return false;

    // pass
    if (expr === 'pass') return undefined;

    // Number
    if (/^-?\d+$/.test(expr)) return parseInt(expr, 10);
    if (/^-?\d+\.\d+$/.test(expr)) return parseFloat(expr);

    // String literal (single, double, triple quotes)
    if ((expr.startsWith('"""') && expr.endsWith('"""')) || (expr.startsWith("'''") && expr.endsWith("'''")))
        return expr.slice(3, -3);
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'")))
        return expr.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t');

    // f-string
    if ((expr.startsWith('f"') && expr.endsWith('"')) || (expr.startsWith("f'") && expr.endsWith("'"))) {
        const inner = expr.slice(2, -1);
        return inner.replace(/\{([^}]+)\}/g, (_, ex) => {
            // Handle format spec like {val:.2f}
            const colonIdx = ex.indexOf(':');
            let expression = ex, fmt = null;
            if (colonIdx > 0) { expression = ex.slice(0, colonIdx); fmt = ex.slice(colonIdx + 1); }
            let val = evalExpr(expression.trim(), vars, funcs, builtins, output);
            if (fmt) val = applyFormat(val, fmt);
            return formatValue(val, false);
        });
    }

    // List literal [...]
    if (expr.startsWith('[') && expr.endsWith(']')) {
        const inner = expr.slice(1, -1).trim();
        if (!inner) return [];
        // list comprehension: [expr for x in iterable]
        const compMatch = inner.match(/^(.+?)\s+for\s+(\w+)\s+in\s+(.+?)(?:\s+if\s+(.+))?$/);
        if (compMatch) {
            const mapExpr = compMatch[1], loopVar = compMatch[2], iterExpr = compMatch[3], condExpr = compMatch[4];
            let iterable = evalExpr(iterExpr, vars, funcs, builtins, output);
            if (!Array.isArray(iterable)) iterable = [...iterable];
            const result = [];
            for (const val of iterable) {
                const localVars = { ...vars, [loopVar]: val };
                if (condExpr) {
                    if (evalExpr(condExpr, localVars, funcs, builtins, output)) {
                        result.push(evalExpr(mapExpr, localVars, funcs, builtins, output));
                    }
                } else {
                    result.push(evalExpr(mapExpr, localVars, funcs, builtins, output));
                }
            }
            return result;
        }
        const items = splitTopLevel(inner, ',');
        return items.map(item => evalExpr(item.trim(), vars, funcs, builtins, output));
    }

    // Dict literal {k: v, ...}
    if (expr.startsWith('{') && expr.endsWith('}') && expr.includes(':')) {
        const inner = expr.slice(1, -1).trim();
        if (!inner) return {};
        const obj = {};
        const items = splitTopLevel(inner, ',');
        for (const item of items) {
            const ci = item.indexOf(':');
            if (ci !== -1) {
                const k = evalExpr(item.slice(0, ci).trim(), vars, funcs, builtins, output);
                const v = evalExpr(item.slice(ci + 1).trim(), vars, funcs, builtins, output);
                obj[k] = v;
            }
        }
        return obj;
    }

    // Set literal {a, b, c}
    if (expr.startsWith('{') && expr.endsWith('}')) {
        const inner = expr.slice(1, -1).trim();
        if (!inner) return [];
        const items = splitTopLevel(inner, ',');
        return [...new Set(items.map(item => evalExpr(item.trim(), vars, funcs, builtins, output)))];
    }

    // Tuple literal (a, b)
    if (expr.startsWith('(') && expr.endsWith(')')) {
        const inner = expr.slice(1, -1).trim();
        if (inner.includes(',')) {
            const items = splitTopLevel(inner, ',');
            return items.map(item => evalExpr(item.trim(), vars, funcs, builtins, output));
        }
        // Parenthesized expression
        return evalExpr(inner, vars, funcs, builtins, output);
    }

    // String multiplication: "⭐" * 3 or "x" * i
    const strMultMatch = expr.match(/^(f?"[^"]*"|f?'[^']*')\s*\*\s*(.+)$/);
    if (strMultMatch) {
        const s = evalExpr(strMultMatch[1], vars, funcs, builtins, output);
        const n = evalExpr(strMultMatch[2], vars, funcs, builtins, output);
        return typeof s === 'string' ? s.repeat(Math.max(0, n)) : s * n;
    }
    // Reverse: 3 * "x"
    const strMultMatch2 = expr.match(/^(.+?)\s*\*\s*(f?"[^"]*"|f?'[^']*')$/);
    if (strMultMatch2) {
        const n = evalExpr(strMultMatch2[1], vars, funcs, builtins, output);
        const s = evalExpr(strMultMatch2[2], vars, funcs, builtins, output);
        return typeof s === 'string' ? s.repeat(Math.max(0, n)) : n * s;
    }

    // Comparison operators and logical operators
    // Handle 'not', 'and', 'or'
    const orParts = splitByKeyword(expr, ' or ');
    if (orParts.length > 1) {
        for (const part of orParts) {
            const val = evalExpr(part.trim(), vars, funcs, builtins, output);
            if (val) return val;
        }
        return false;
    }

    const andParts = splitByKeyword(expr, ' and ');
    if (andParts.length > 1) {
        let result;
        for (const part of andParts) {
            result = evalExpr(part.trim(), vars, funcs, builtins, output);
            if (!result) return result;
        }
        return result;
    }

    if (expr.startsWith('not ')) {
        return !evalExpr(expr.slice(4), vars, funcs, builtins, output);
    }

    // 'in' operator: x in y
    const inMatch = expr.match(/^(.+?)\s+in\s+(.+)$/);
    if (inMatch && !expr.includes(' for ')) {
        const left = evalExpr(inMatch[1].trim(), vars, funcs, builtins, output);
        const right = evalExpr(inMatch[2].trim(), vars, funcs, builtins, output);
        if (typeof right === 'string') return right.includes(left);
        if (Array.isArray(right)) return right.includes(left);
        if (typeof right === 'object') return left in right;
        return false;
    }

    // not in
    const notInMatch = expr.match(/^(.+?)\s+not\s+in\s+(.+)$/);
    if (notInMatch) {
        const left = evalExpr(notInMatch[1].trim(), vars, funcs, builtins, output);
        const right = evalExpr(notInMatch[2].trim(), vars, funcs, builtins, output);
        if (typeof right === 'string') return !right.includes(left);
        if (Array.isArray(right)) return !right.includes(left);
        return !(left in right);
    }

    // Ternary: value_if_true if condition else value_if_false
    const ternaryMatch = expr.match(/^(.+?)\s+if\s+(.+?)\s+else\s+(.+)$/);
    if (ternaryMatch) {
        const cond = evalExpr(ternaryMatch[2], vars, funcs, builtins, output);
        return cond ? evalExpr(ternaryMatch[1], vars, funcs, builtins, output) : evalExpr(ternaryMatch[3], vars, funcs, builtins, output);
    }

    // Comparison: ==, !=, <=, >=, <, >
    for (const op of ['==', '!=', '<=', '>=', '<', '>']) {
        const idx = expr.indexOf(op);
        if (idx > 0) {
            const left = evalExpr(expr.slice(0, idx), vars, funcs, builtins, output);
            const right = evalExpr(expr.slice(idx + op.length), vars, funcs, builtins, output);
            switch (op) {
                case '==': return left == right;
                case '!=': return left != right;
                case '<=': return left <= right;
                case '>=': return left >= right;
                case '<': return left < right;
                case '>': return left > right;
            }
        }
    }

    // Arithmetic: try to split by +, -, *, /, //, %, **
    // Handle + for string concatenation and number addition
    const addParts = splitArithmetic(expr, ['+', '-']);
    if (addParts) {
        let result = evalExpr(addParts[0].trim(), vars, funcs, builtins, output);
        for (let j = 1; j < addParts.length; j += 2) {
            const op = addParts[j];
            const right = evalExpr(addParts[j + 1].trim(), vars, funcs, builtins, output);
            if (op === '+') {
                if (typeof result === 'string' || typeof right === 'string') result = String(result) + String(right);
                else result = result + right;
            } else {
                result = result - right;
            }
        }
        return result;
    }

    const mulParts = splitArithmetic(expr, ['**', '//', '*', '/', '%']);
    if (mulParts) {
        let result = evalExpr(mulParts[0].trim(), vars, funcs, builtins, output);
        for (let j = 1; j < mulParts.length; j += 2) {
            const op = mulParts[j];
            const right = evalExpr(mulParts[j + 1].trim(), vars, funcs, builtins, output);
            if (op === '**') result = Math.pow(result, right);
            else if (op === '//') result = Math.floor(result / right);
            else if (op === '*') result = result * right;
            else if (op === '/') result = result / right;
            else if (op === '%') result = result % right;
        }
        return result;
    }

    // Method call on variable: var.method(args) or var.attribute
    const dotMatch = expr.match(/^(\w+)\.(.+)$/);
    if (dotMatch) {
        const objName = dotMatch[1];
        const rest = dotMatch[2];
        let obj = vars[objName] !== undefined ? vars[objName] : builtins[objName];

        if (obj !== undefined) {
            return handleDotAccess(obj, rest, vars, funcs, builtins, output);
        }
    }

    // Indexing: var[index]
    const indexMatch = expr.match(/^(\w+)\[(.+)\]$/);
    if (indexMatch) {
        const obj = vars[indexMatch[1]];
        if (obj !== undefined) {
            const idx = indexMatch[2];
            // Handle slicing: a[1:3]
            if (idx.includes(':')) {
                const sliceParts = idx.split(':').map(s => s.trim() ? evalExpr(s.trim(), vars, funcs, builtins, output) : null);
                const start = sliceParts[0], stop = sliceParts[1], step = sliceParts[2];
                if (typeof obj === 'string' || Array.isArray(obj)) {
                    return sliceArray(obj, start, stop, step);
                }
            }
            const i = evalExpr(idx, vars, funcs, builtins, output);
            if (typeof i === 'number' && i < 0) return obj[obj.length + i];
            return obj[i];
        }
    }

    // Function call: name(args)
    const funcMatch = expr.match(/^(\w+)\s*\((.*)?\)$/s);
    if (funcMatch) {
        const fname = funcMatch[1];
        const argsStr = funcMatch[2] || '';

        // print handled above, but catch it here too
        if (fname === 'print') {
            handlePrint('print(' + argsStr + ')', vars, funcs, builtins, output);
            return undefined;
        }

        if (fname === 'input') {
            const prompt = argsStr.trim() ? evalExpr(argsStr.trim(), vars, funcs, builtins, output) : '';
            return window.prompt(prompt || '') || '';
        }

        // Built-in
        if (builtins[fname]) {
            const args = argsStr.trim() ? splitTopLevel(argsStr, ',').map(a => evalExpr(a.trim(), vars, funcs, builtins, output)) : [];
            return builtins[fname](...args);
        }

        // User-defined function
        if (funcs[fname]) {
            const fn = funcs[fname];
            const args = argsStr.trim() ? splitTopLevel(argsStr, ',').map(a => evalExpr(a.trim(), vars, funcs, builtins, output)) : [];
            const localVars = { ...vars };
            fn.params.forEach((p, idx) => {
                const parts = p.split('=');
                const pname = parts[0].trim();
                localVars[pname] = args[idx] !== undefined ? args[idx] : (parts[1] ? evalExpr(parts[1].trim(), vars, funcs, builtins, output) : undefined);
            });
            executeBlock(fn.lines, fn.bodyStart, fn.bodyEnd, localVars, funcs, builtins, output, 0);
            // Copy back any modified variables (simplified scope)
            return localVars['__return__'];
        }
    }

    // Variable lookup
    if (/^[a-zA-Z_]\w*$/.test(expr)) {
        if (vars[expr] !== undefined) return vars[expr];
        if (builtins[expr]) return builtins[expr];
        return undefined;
    }

    // Comma-separated values (tuple)
    if (expr.includes(',') && !expr.includes('(') && !expr.includes('[')) {
        const parts = expr.split(',').map(p => evalExpr(p.trim(), vars, funcs, builtins, output));
        return parts;
    }

    return expr;
}

/* ===== DOT ACCESS HANDLER ===== */
function handleDotAccess(obj, rest, vars, funcs, builtins, output) {
    // Method call: .method(args)
    const methodMatch = rest.match(/^(\w+)\((.*)?\)$/s);
    if (methodMatch) {
        const method = methodMatch[1];
        const argsStr = methodMatch[2] || '';
        const args = argsStr.trim() ? splitTopLevel(argsStr, ',').map(a => evalExpr(a.trim(), vars, funcs, builtins, output)) : [];

        // String methods
        if (typeof obj === 'string') {
            const strMethods = {
                upper: () => obj.toUpperCase(),
                lower: () => obj.toLowerCase(),
                title: () => obj.replace(/\b\w/g, c => c.toUpperCase()),
                strip: () => obj.trim(),
                lstrip: () => obj.trimStart(),
                rstrip: () => obj.trimEnd(),
                split: () => args.length ? obj.split(args[0]) : obj.split(/\s+/),
                join: () => args[0].join(obj),
                replace: () => obj.split(args[0]).join(args[1]),
                startswith: () => obj.startsWith(args[0]),
                endswith: () => obj.endsWith(args[0]),
                find: () => obj.indexOf(args[0]),
                count: () => (obj.match(new RegExp(args[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
                isdigit: () => /^\d+$/.test(obj),
                isalpha: () => /^[a-zA-Z]+$/.test(obj),
                format: () => { let s = obj; args.forEach((a, i) => { s = s.replace('{}', formatValue(a, false)); }); return s; },
                index: () => { const i = obj.indexOf(args[0]); if (i === -1) throw new Error('substring not found'); return i; },
                capitalize: () => obj.charAt(0).toUpperCase() + obj.slice(1).toLowerCase(),
                swapcase: () => [...obj].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''),
                center: () => obj.padStart(Math.floor((args[0] + obj.length) / 2)).padEnd(args[0]),
                zfill: () => obj.padStart(args[0], '0'),
            };
            if (strMethods[method]) return strMethods[method]();
        }

        // List methods
        if (Array.isArray(obj)) {
            const listMethods = {
                append: () => { obj.push(args[0]); return undefined; },
                pop: () => args.length ? obj.splice(args[0], 1)[0] : obj.pop(),
                insert: () => { obj.splice(args[0], 0, args[1]); return undefined; },
                remove: () => { const i = obj.indexOf(args[0]); if (i > -1) obj.splice(i, 1); return undefined; },
                sort: () => { obj.sort((a, b) => a - b); return undefined; },
                reverse: () => { obj.reverse(); return undefined; },
                index: () => obj.indexOf(args[0]),
                count: () => obj.filter(x => x === args[0]).length,
                extend: () => { obj.push(...args[0]); return undefined; },
                copy: () => [...obj],
                clear: () => { obj.length = 0; return undefined; },
            };
            if (listMethods[method]) return listMethods[method]();
        }

        // Dict methods
        if (typeof obj === 'object' && !Array.isArray(obj)) {
            const dictMethods = {
                keys: () => Object.keys(obj),
                values: () => Object.values(obj),
                items: () => Object.entries(obj),
                get: () => obj[args[0]] !== undefined ? obj[args[0]] : (args[1] !== undefined ? args[1] : null),
                update: () => { Object.assign(obj, args[0]); return undefined; },
                pop: () => { const v = obj[args[0]]; delete obj[args[0]]; return v !== undefined ? v : args[1]; },
            };
            if (dictMethods[method]) return dictMethods[method]();
        }
    }

    // Property access
    const prop = rest.trim();
    if (typeof obj === 'object' && obj !== null && prop in obj) return obj[prop];
    if (Array.isArray(obj) || typeof obj === 'string') {
        if (prop === 'length') return obj.length;
    }

    return undefined;
}

/* ===== FORMAT SPEC ===== */
function applyFormat(val, fmt) {
    if (fmt.endsWith('f')) {
        const prec = parseInt(fmt.slice(0, -1)) || 0;
        return Number(val).toFixed(prec);
    }
    if (fmt.endsWith('d')) {
        const width = parseInt(fmt) || 0;
        return String(Math.floor(val)).padStart(width);
    }
    if (fmt.includes('>')) {
        const parts = fmt.split('>');
        return String(val).padStart(parseInt(parts[1]), parts[0] || ' ');
    }
    if (fmt.includes('<')) {
        const parts = fmt.split('<');
        return String(val).padEnd(parseInt(parts[1]), parts[0] || ' ');
    }
    return String(val);
}

/* ===== ARRAY SLICING ===== */
function sliceArray(arr, start, stop, step) {
    const len = arr.length;
    if (step && step < 0) {
        // Reverse slicing
        const s = start !== null ? (start < 0 ? len + start : start) : len - 1;
        const e = stop !== null ? (stop < 0 ? len + stop : stop) : -1;
        const result = [];
        for (let i = s; i > e; i += step) {
            result.push(typeof arr === 'string' ? arr[i] : arr[i]);
        }
        return typeof arr === 'string' ? result.join('') : result;
    }
    const s = start !== null ? (start < 0 ? Math.max(0, len + start) : start) : 0;
    const e = stop !== null ? (stop < 0 ? len + stop : stop) : len;
    return typeof arr === 'string' ? arr.slice(s, e) : arr.slice(s, e);
}

/* ===== UTILITY: Split by top-level delimiter ===== */
function splitTopLevel(str, delim) {
    const parts = [];
    let depth = 0, start = 0, inStr = false, strChar = '';
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (inStr) { if (c === strChar && str[i - 1] !== '\\') inStr = false; continue; }
        if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
        if ('([{'.includes(c)) depth++;
        if (')]}'.includes(c)) depth--;
        if (depth === 0 && str.substring(i, i + delim.length) === delim) {
            parts.push(str.substring(start, i));
            start = i + delim.length;
            i += delim.length - 1;
        }
    }
    parts.push(str.substring(start));
    return parts;
}

/* ===== UTILITY: Split by keyword outside strings ===== */
function splitByKeyword(str, keyword) {
    const parts = [];
    let depth = 0, start = 0, inStr = false, strChar = '';
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (inStr) { if (c === strChar && str[i - 1] !== '\\') inStr = false; continue; }
        if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
        if ('([{'.includes(c)) depth++;
        if (')]}'.includes(c)) depth--;
        if (depth === 0 && str.substring(i, i + keyword.length) === keyword) {
            parts.push(str.substring(start, i));
            start = i + keyword.length;
            i += keyword.length - 1;
        }
    }
    parts.push(str.substring(start));
    return parts;
}

/* ===== UTILITY: Split arithmetic ===== */
function splitArithmetic(expr, ops) {
    let depth = 0, inStr = false, strChar = '';
    const tokens = [];
    let current = '';

    for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        if (inStr) { current += c; if (c === strChar && expr[i - 1] !== '\\') inStr = false; continue; }
        if (c === '"' || c === "'") { inStr = true; strChar = c; current += c; continue; }
        if ('([{'.includes(c)) { depth++; current += c; continue; }
        if (')]}'.includes(c)) { depth--; current += c; continue; }

        if (depth === 0) {
            let found = false;
            for (const op of ops) {
                if (expr.substring(i, i + op.length) === op) {
                    // Make sure it's not part of ** when looking for *
                    if (op === '*' && expr[i + 1] === '*') continue;
                    if (op === '/' && expr[i + 1] === '/') continue;
                    if (current.trim()) {
                        tokens.push(current.trim());
                        tokens.push(op);
                        current = '';
                        i += op.length - 1;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) current += c;
        } else {
            current += c;
        }
    }
    if (current.trim()) tokens.push(current.trim());
    return tokens.length > 1 ? tokens : null;
}

// Load sample code into playground
function loadSample(code) {
    const editor = document.getElementById('playground-editor');
    if (editor) {
        editor.value = code;
        editor.scrollIntoView({ behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', initPlayground);
