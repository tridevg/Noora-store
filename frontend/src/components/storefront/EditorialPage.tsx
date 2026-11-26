import type { ReactNode } from 'react';

/** Shared frame for static pages: eyebrow, display heading, lead paragraph, then sections. */
export function EditorialPage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl space-y-10 py-6">
      <header className="space-y-3 border-b border-border pb-8">
        <p className="text-small font-semibold tracking-wide text-accent uppercase">{eyebrow}</p>
        <h1 className="text-display font-semibold text-ink">{title}</h1>
        <p className="text-heading text-muted">{lead}</p>
      </header>
      {children}
    </article>
  );
}

/** A labelled section inside an EditorialPage. The heading id keeps the region named. */
export function EditorialSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-heading font-semibold text-ink">
        {heading}
      </h2>
      {children}
    </section>
  );
}
