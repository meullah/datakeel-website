// Case study visuals: id = file name (kebab-case) of an inline-SVG component in this folder.
// ponytail: the glob is the registry, so adding a file is the only step.
const modules = import.meta.glob<{ default: any }>('./*.astro', { eager: true });

export const visuals: Record<string, any> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [path.slice(2, -'.astro'.length), mod.default]),
);

/** The component for a case's `visual.id`; throws (failing the build) when there is none. */
export function visualFor(entryId: string, visualId: string) {
  const component = Object.hasOwn(visuals, visualId) ? visuals[visualId] : undefined;
  if (!component) throw new Error(`caseStudies/${entryId}: no visual component "${visualId}"`);
  return component;
}
