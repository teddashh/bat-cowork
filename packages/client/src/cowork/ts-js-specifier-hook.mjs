import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Node's type stripper does not rewrite a `.js` specifier to a sibling `.ts`
 * file. The client sources use NodeNext `.js` specifiers. This hook is test-only:
 * it rewrites those specifiers while the parent module is still under
 * `packages/client/src`. Published `dist` imports are left alone.
 */
export async function resolve(specifier, context, nextResolve) {
  const parentURL = context.parentURL ?? "";
  const relativeJs =
    (specifier.startsWith("./") || specifier.startsWith("../")) && specifier.endsWith(".js");
  if (relativeJs && parentURL.includes("/packages/client/src/")) {
    const tsSpecifier = `${specifier.slice(0, -3)}.ts`;
    try {
      const resolved = await nextResolve(tsSpecifier, context);
      if (existsSync(fileURLToPath(resolved.url))) return resolved;
    } catch {
      // The sibling .ts file is not there; resolve the original specifier.
    }
  }
  return nextResolve(specifier, context);
}
