# Math on Selections

Apply a math equation to every number found inside your VSCode selections — with
big-number precision (no floating-point errors) and automatic hex format preservation.

---

## Install

```bash
cd math-on-selections
npm install
npm run compile
```

Then press **F5** in VSCode to launch an Extension Development Host, *or* package
it with `npx vsce package` and install the `.vsix` from the Extensions panel
(**⋮ → Install from VSIX…**).

---

## Usage

1. Select one or more regions of text containing numbers.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **"Math: Apply Equation to Selected Numbers"**.
4. Type your equation and press **Enter**.

After the replacement every changed number is automatically re-selected.

---

## Equation syntax

| Input | Meaning |
|---|---|
| `$/2` | divide each number by 2 |
| `$*2` | multiply each number by 2 |
| `$+100` | add 100 to each number |
| `($+1)*4` | add 1 then multiply by 4 |
| `/2` | same as `$/2` ($ prepended when absent) |
| `*2+1` | same as `$*2+1` |

`$` is replaced with the current number value.  
Standard operator precedence applies (`*` and `/` before `+` and `-`).

---

## Hex number support

Hex literals like `0x0E`, `0xFF`, `0xdeadbeef` are detected automatically.

- The result is converted back to hex.
- Non-integer results are rounded to the nearest integer.
- **Case is preserved** per the rules below:

| Original digits | Output |
|---|---|
| All uppercase (`0xFF`) | Uppercase (`0xFF`) |
| All lowercase (`0xff`) | Lowercase (`0xff`) |
| Mixed (`0xdEaD`) | Uppercase (default) |
| Only digits (`0x123`) | Uppercase (default) |

---

## Math precision

All arithmetic uses exact string-based big-number routines (no `Number`
floating-point), so operations like `1543.52 / 1.5601` are computed precisely.
Division results are rounded to 10 decimal places by default.

---

## Keybinding (optional)

Add to your `keybindings.json`:

```json
{
  "key": "ctrl+shift+m",
  "command": "mathOnSelections.run",
  "when": "editorHasSelection"
}
```
