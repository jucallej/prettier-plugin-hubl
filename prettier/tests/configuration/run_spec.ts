// source: https://github.com/prettier/prettier/blob/ee2839bacbf6a52d004fa2f0373b732f6f191ccc/tests_config/run_spec.js
"use strict";

import fs from "fs";
import path from "path";
import prettier, { ParserOptions } from "prettier";
import { expect, it, describe } from "@jest/globals";

type TestObject = {
  fileName: string;
  dirName: string;
  source: string;
  input: string;
  mergedOptions: ParserOptions;
};

const RAW = Symbol.for("raw");
expect.addSnapshotSerializer({
  print(val: unknown) {
    return (val as Record<symbol, string>)[RAW];
  },
  test(val: Record<symbol, string>) {
    return (
      val &&
      Object.prototype.hasOwnProperty.call(val, RAW) &&
      typeof val[RAW] === "string"
    );
  },
});

function createTestObject(
  dirName: string,
  fileName: string,
  options: ParserOptions,
): TestObject | undefined {
  const filePath = path.join(dirName, fileName);
  const isValidTestFile =
    path.extname(fileName) !== ".snap" &&
    fs.lstatSync(filePath).isFile() &&
    fileName[0] !== "." &&
    fileName !== "run_tests.js";

  if (!isValidTestFile) return undefined;

  let rangeStart = 0;
  let rangeEnd = Infinity;
  let cursorOffset;
  const source = fs
    .readFileSync(filePath, "utf-8")
    .replace(/\r\n/g, "\n")
    .replace("<<<PRETTIER_RANGE_START>>>", (_, offset) => {
      rangeStart = offset;
      return "";
    })
    .replace("<<<PRETTIER_RANGE_END>>>", (_, offset) => {
      rangeEnd = offset;
      return "";
    });

  const input = source.replace("<|>", (_, offset) => {
    cursorOffset = offset;
    return "";
  });

  const mergedOptions = Object.assign(mergeDefaultOptions(options || {}), {
    filePath,
    rangeStart,
    rangeEnd,
    cursorOffset,
    parser: "hubl",
  });

  return {
    fileName,
    dirName,
    source,
    input,
    mergedOptions,
  };
}

const IDEMPOTENCY_FIXTURES = new Set([
  "idempotent-dict-ternary.html",
  "idempotent-svg-path.html",
  "set.html",
  "ternary.html",
  "regex-filters.html",
  "sliceSyntax.html",
  "svg-nested-hubl-expression.html",
  "svg-own-tag-hubl-expression.html",
  "namespace-attribute-assignment.html",
  "conditional-html-wrapper.html",
  "conditional-html-wrapper-closing.html",
  "from-import-and-separator.html",
  "nested-multiline-funcall.html",
  "module-attribute-svg-preserve.html",
  "hubl-none-literal.html",
  "json-ld-hubl-conditional.html",
  "conditional-html-nested-expression.html",
  "call-dict-indentation.html",
  "empty-dict-literal.html",
  "custom-tags.html",
  "macro-multiline.html",
  "conditional-html-elif-branches.html",
  "hubl-in-tag-name-position.html",
  "break-continue.html",
  "unclosed-element-scan.html",
  "tag-regex-overmatch.html",
  "inline-block-tag-after-tag-close.html",
  "split-closing-tag-expression.html",
  "nested-same-tag-element-scan.html",
]);

const REGRESSION_ASSERTIONS: Record<string, (output: string) => void> = {
  "module-attribute-svg-preserve.html": (output) => {
    expect(output).not.toMatch(/\{%-?\s*(end)?preserve/i);
  },
  "hubl-none-literal.html": (output) => {
    expect(output).toContain("none");
    expect(output).not.toMatch(/\bnull\b/);
  },
  "conditional-html-nested-expression.html": (output) => {
    expect(output).toContain("</main>");
    expect(output).not.toMatch(/<!--conditionalblock-\d+-->\s*<\/main>/);
  },
  "call-dict-indentation.html": (output) => {
    const callBlockMatch = output.match(
      /(\s*)\{% call menuMacros\.MenuTrigger\(\{[\s\S]*?\}\) %\}/,
    );
    expect(callBlockMatch).not.toBeNull();
    const baseIndent = callBlockMatch![1];
    const callBlock = callBlockMatch![0];
    const propertyIndent = `${baseIndent}  `;
    expect(callBlock).toContain(`${propertyIndent}anchorId:`);
    expect(callBlock).toContain(`${propertyIndent}classExtension:`);
    expect(callBlock).toContain(`${baseIndent}}) %}`);
  },
  "empty-dict-literal.html": (output) => {
    expect(output).toContain("{% set items = {} %}");
    expect(output).toMatch(/\{% macro Toggle\(config\s*=\s*\{\}\) %\}/);
    expect(output).toMatch(/"header": \{\}/);
    expect(output).not.toMatch(/\{\n\}/);
  },
  "misc.html": (output) => {
    expect(output).toContain("is string_containing(pathFragment) or");
    expect(output).not.toContain("is string_containing(pathFragment or");
    expect(output).toContain("is string_containing(x) and");
    expect(output).not.toContain("is string_containing(x and");
    expect(output).toContain("is not string_containing(bar) or");
    expect(output).not.toContain("is not string_containing(bar or");
  },
  "custom-tags.html": (output) => {
    expect(output).toContain("{% my_self_closing_tag");
    expect(output).toContain("{% my_block_tag");
    expect(output).toContain("{% end_my_block_tag %}");
  },
  "macro-multiline.html": (output) => {
    expect(output).toMatch(/{% macro LongMacroName\(\n/);
    expect(output).toContain("  show_cta=true,");
    expect(output).toContain("  powered_by=false");
    expect(output).toMatch(/^\)\ %}/m);
  },
  "hubl-in-tag-name-position.html": (output) => {
    // The <main> element must be preserved — not merged into an unknown
    // element like <mainnpe0_> that would make </main> appear unexpected.
    expect(output).toContain("<main");
    expect(output).toContain("</main>");
    expect(output).not.toMatch(/<main\w/);
  },
  "nested-same-tag-element-scan.html": (output) => {
    // The outer `<div>` opening tag is split across lines by its conditional
    // attributes, and its children nest more `<div>` elements.  When the
    // element scan stops at the first `</div>` instead of the matching one, the
    // bundled `{% preserve %}` block captures `{% if tooltip_text %}` but not
    // its `{% endif %}`, and the HubL parser fails with
    // "unknown block tag: endif".
    expect(output).toContain("{% if tooltip_text %}");
    expect(output).toContain("{% endif %}");
    expect(output).toContain("{% endset %}");
    expect(output).toContain("{% endmacro %}");
    expect(output).not.toMatch(/\{%\s*preserve\s*%\}[\s\S]*\{%\s*endset\s*%\}/);
    expect(output).not.toMatch(/<!--conditionalblock-\d+-->/);
  },
  "unclosed-element-scan.html": (output) => {
    // The `<span …>` opening tag is split across lines and its closing tag is
    // written as `</span` + a lone `>`.  When the closing tag is not matched,
    // the element scan runs to end of file and swallows the enclosing
    // `{% endif %}` / `{% endcall %}` into one opaque `{% preserve %}` block —
    // the next format pass then fails with "parseIf: expected elif, else, or
    // endif, got end of file".
    expect(output).toContain("{% endif %}");
    expect(output).toContain("{% endcall %}");
    expect(output).toContain("{% endmacro %}");
    expect(output).not.toMatch(
      /\{%\s*preserve\s*%\}[\s\S]*\{%\s*endcall\s*%\}/,
    );
  },
  "tag-regex-overmatch.html": (output) => {
    // The tag-matching regex must stop at each tag's own `>`.  When it ran on
    // past it, the `{% endif %}`, the sibling `<p>` and the `<a>` element were
    // all pulled into one match and re-tokenised as short `npe` tokens, which
    // changed the HTML formatter's wrapping decisions between passes.
    expect(output).not.toMatch(
      /npe\d+_|<!--(?:placeholder|comment|conditionalblock|svgblock)-\d+-->/,
    );
    expect(output).toContain("<img");
    expect(output).toContain("</p>");
    expect(output).toContain("</a>");
    expect(output).toContain("visually-hidden");
    expect(output.match(/{%-?\s*endif\s*-?%}/g)!.length).toBe(5);
  },
  "inline-block-tag-after-tag-close.html": (output) => {
    // `{% if c %}<img …>{% endif %}` leaves the `{% endif %}` token glued to
    // the `/>` once the HTML formatter breaks the element across lines, and the
    // HubL printer then emitted it at column 0.
    expect(output).not.toMatch(/^\{%\s*endif\s*%\}/m);
    expect(output).toMatch(/^[ \t]+\{%\s*endif\s*%\}/m);
  },
  "split-closing-tag-expression.html": (output) => {
    // A trailing `{{ … }}` on the `>` of a split `</span` closing tag is
    // element content and must stay put; moving it onto its own line would be
    // reverted by the next pass.
    expect(output).toMatch(/>\{\{ AuthorLink\(module\.secondary_author/);
  },
  "conditional-html-elif-branches.html": (output) => {
    // The preserve wrapper is an internal implementation detail and must not
    // appear in the final output. What matters is that all branch markers and
    // HTML elements are present and unchanged.
    expect(output).not.toMatch(/\{%\s*preserve\s*%\}/);
    expect(output).toContain("<main");
    expect(output).toContain("</main>");
    expect(output).toContain("{% if topic %}");
    expect(output).toContain("{% elif author %}");
    expect(output).toContain("{% elif isLandingPage %}");
    expect(output).toContain("{% else %}");
    expect(output).toContain("{% endif %}");
    // All three main elements must be preserved verbatim (not merged/dropped).
    const mainMatches = output.match(/<main\b/g);
    expect(mainMatches).not.toBeNull();
    expect(mainMatches!.length).toBe(3);
  },
};

async function run_spec(dirName, options) {
  const testObjects = fs
    .readdirSync(dirName)
    .map((fileName) => createTestObject(dirName, fileName, options))
    .filter((testObj) => testObj !== undefined) as TestObject[];

  testObjects.forEach(async (testObj) => {
    const { fileName, source, input, mergedOptions } = testObj;
    it(`formats ${fileName} correctly`, async () => {
      const output = await prettyprint(input, mergedOptions);
      const snapshot = raw(
        source + "~".repeat(mergedOptions.printWidth) + "\n" + output,
      );
      expect(snapshot).toMatchSnapshot();
    });
    if (IDEMPOTENCY_FIXTURES.has(fileName)) {
      it(`formats ${fileName} idempotently`, async () => {
        const firstPass = await prettyprint(input, mergedOptions);
        const secondPass = await prettyprint(firstPass, mergedOptions);
        expect(secondPass).toBe(firstPass);
      });
    }
    if (REGRESSION_ASSERTIONS[fileName]) {
      it(`formats ${fileName} with regression assertions`, async () => {
        const output = await prettyprint(input, mergedOptions);
        REGRESSION_ASSERTIONS[fileName](output);
      });
    }
  });
}

async function prettyprint(src, options) {
  const result = await prettier.formatWithCursor(src, options);
  if (options.cursorOffset >= 0) {
    result.formatted =
      result.formatted.slice(0, result.cursorOffset) +
      "<|>" +
      result.formatted.slice(result.cursorOffset);
  }
  return result.formatted;
}

global.run_spec = run_spec;

/**
 * Wraps a string in a marker object that is used by `./raw-serializer.js` to
 * directly print that string in a snapshot without escaping all double quotes.
 * Backticks will still be escaped.
 */
function raw(string) {
  if (typeof string !== "string") {
    throw new Error("Raw snapshots have to be strings.");
  }
  return { [Symbol.for("raw")]: string };
}

function mergeDefaultOptions(parserConfig) {
  return Object.assign(
    {
      plugins: [
        path.resolve(path.join(__dirname, "../.."), "dist/src/index.js"),
      ],
      printWidth: 80,
    },
    parserConfig,
  );
}
