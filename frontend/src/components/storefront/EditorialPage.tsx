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
      <header className="space-y-3 border-b border-border-subtle pb-8">
        <p className="text-small font-semibold tracking-wide text-sage-hover uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display text-[2.6rem] leading-[1.05] font-medium text-ink-primary md:text-[3.4rem]">
          {title}
        </h1>
        <p className="font-ui text-[1.125rem] leading-relaxed text-ink-muted">{lead}</p>
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
      <h2 id={id} className="font-display text-[1.6rem] leading-tight font-medium text-ink-primary">
        {heading}
      </h2>
      {children}
    </section>
  );
}
