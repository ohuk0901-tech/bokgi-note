"use client";

import Link from "next/link";
import { Archive, Folder, Settings } from "lucide-react";

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f4] text-[#1f1f1f]">
      <header className="sticky top-0 z-20 border-b border-[#dddeda] bg-[#f7f7f4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/folders" className="text-lg font-semibold">
            복기노트
          </Link>
          <nav className="flex items-center gap-1">
            <IconLink href="/folders" label="폴더">
              <Folder size={19} />
            </IconLink>
            <IconLink href="/trash" label="휴지통">
              <Archive size={19} />
            </IconLink>
            <IconLink href="/settings" label="설정">
              <Settings size={19} />
            </IconLink>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-5">{children}</div>
    </div>
  );
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-[#53584f] hover:bg-[#ebeee9] hover:text-[#1f1f1f]"
    >
      {children}
    </Link>
  );
}
