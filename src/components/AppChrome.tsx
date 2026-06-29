"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Folder, MoreHorizontal, Settings } from "lucide-react";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bokgi-bg text-bokgi-ink">
      <header className="sticky top-0 z-20 border-b border-bokgi-border bg-bokgi-bg/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold">
            복기노트
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-bokgi-ink-soft hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
            aria-label="메뉴"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={22} />
          </button>
          {menuOpen ? (
            <nav className="absolute right-4 top-12 z-30 w-44 overflow-hidden rounded-[var(--radius-panel)] border border-bokgi-border bg-bokgi-surface py-1 text-sm shadow-lg">
              <MenuLink href="/folders" label="폴더" onClick={() => setMenuOpen(false)}>
                <Folder size={17} />
              </MenuLink>
              <MenuLink href="/trash" label="휴지통" onClick={() => setMenuOpen(false)}>
                <Archive size={17} />
              </MenuLink>
              <MenuLink href="/settings" label="설정" onClick={() => setMenuOpen(false)}>
                <Settings size={17} />
              </MenuLink>
            </nav>
          ) : null}
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-5">{children}</div>
    </div>
  );
}

function MenuLink({
  href,
  label,
  children,
  onClick,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 text-bokgi-ink-soft hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}
