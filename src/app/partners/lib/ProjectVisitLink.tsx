export function ProjectVisitLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 self-start border-b border-crafd-yellow/40 pb-px text-xs font-bold tracking-widest text-crafd-yellow uppercase no-underline transition-colors hover:border-crafd-yellow"
    >
      Visit project page
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      >
        <path
          d="M2 10L10 2M10 2H5M10 2v5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
