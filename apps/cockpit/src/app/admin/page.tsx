import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';

const ADMIN_SECTIONS = [
  {
    title: 'Divisions',
    description: 'Manage driver division and tier assignments.',
    tools: [
      {
        label: 'Division Assignment',
        href: '/admin/divisions',
        description:
          'Assign divisions and tiers to drivers, including bulk assignment by pasted Discord ID.',
      },
    ],
  },
  {
    title: 'Standings',
    description: 'Manage manually-uploaded championship standings.',
    tools: [
      {
        label: 'Standings Upload',
        href: '/admin/standings',
        description:
          'Upload standings data for championships without a live API source.',
      },
    ],
  },
];

export default async function AdminIndexPage() {
  // Defense in depth: gate at page render AND every server action
  await requireAdmin();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Admin
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Admin
      </h1>

      <div className="flex flex-col gap-10 max-w-[720px]">
        {ADMIN_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-display font-bold text-[22px] uppercase text-gold mb-1">
              {section.title}
            </h2>
            <p className="font-sans text-sm text-txt-3 mb-4">{section.description}</p>
            <div className="flex flex-col gap-3">
              {section.tools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="border border-line bg-panel px-5 py-4 hover:border-gold/50 hover:bg-panel-2 transition-colors"
                >
                  <span className="font-mono text-[13px] tracking-[.1em] uppercase text-txt">
                    {tool.label}
                  </span>
                  <span className="block font-sans text-[13px] text-txt-3 mt-1">
                    {tool.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
