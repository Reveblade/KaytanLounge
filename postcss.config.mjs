/**
 * Smart TVs discard `@layer` and lose every Tailwind utility. Flattening layers
 * is required for those engines, but author CSS in this file is unlayered on
 * purpose — it must still beat utilities, which is the native cascade. So the
 * unlayered nodes are lifted out, layers are unwrapped, then the author CSS is
 * put back at the end. `:where()` is left alone: preflight uses it for zero
 * specificity, and unwrapping it is what bleached the desktop.
 */
function tvCompat() {
  return {
    postcssPlugin: "tv-compat",
    Once(root) {
      const unlayered = [];
      for (const node of [...root.nodes]) {
        if (node.type === "atrule" && node.name === "layer") continue;
        unlayered.push(node);
        node.remove();
      }
      unwrapLayers(root);
      for (const node of unlayered) root.append(node);
      injectPropertyFallbacks(root);
      root.walkDecls((decl) => {
        rewriteGradientColorSpace(decl);
        prependUnitFallback(decl, "dvh", "vh");
        prependOverflowClipFallback(decl);
      });
    },
  };
}
tvCompat.postcss = true;

function unwrapLayers(root) {
  let passes = 0;
  while (passes < 8) {
    const layers = [];
    root.walkAtRules("layer", (rule) => layers.push(rule));
    if (!layers.length) return;
    for (const rule of layers) {
      if (rule.nodes?.length) rule.replaceWith(rule.nodes);
      else rule.remove();
    }
    passes += 1;
  }
}

function injectPropertyFallbacks(root) {
  const decls = [];
  root.walkAtRules("property", (rule) => {
    const name = rule.params.trim();
    let initial;
    rule.walkDecls((decl) => {
      if (decl.prop === "initial-value") initial = decl.value;
    });
    if (name && initial !== undefined) decls.push({ name, initial });
  });
  if (!decls.length) return;
  let sample;
  root.walkRules((rule) => {
    if (!sample) sample = rule;
  });
  if (!sample) return;
  const vars = sample.clone({ selector: "*, ::before, ::after", nodes: [] });
  for (const { name, initial } of decls) {
    vars.append({ prop: name, value: initial });
  }
  root.prepend(vars);
}

function rewriteGradientColorSpace(decl) {
  if (!decl.value) return;
  const next = decl.value.replace(/\s+in\s+(oklab|oklch|srgb|lab|xyz)\b/gi, "");
  if (next !== decl.value) decl.value = next;
}

function prependUnitFallback(decl, from, to) {
  if (!decl.value || !decl.value.includes(from)) return;
  const fallback = decl.value.replaceAll(from, to);
  if (fallback !== decl.value) decl.cloneBefore({ value: fallback });
}

function prependOverflowClipFallback(decl) {
  if (decl.value !== "clip") return;
  if (decl.prop === "overflow" || decl.prop === "overflow-x" || decl.prop === "overflow-y") {
    decl.cloneBefore({ value: "hidden" });
  }
}

const config = {
  plugins: ["@tailwindcss/postcss", tvCompat],
};

export default config;
