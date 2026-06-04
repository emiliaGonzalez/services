"use client";

import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function Header() {
  const pathname = usePathname();

  const tabs = [
    { label: "Eventos", href: "/eventos" },
    { label: "Servicios", href: "/servicios" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b-2 border-foreground bg-background">
      <div className="flex h-14 items-center justify-between px-8">
        <span className="text-base font-bold tracking-widest">BRYTSPACE</span>

        <nav className="flex items-center gap-8">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");

            return (
              <a
                key={tab.href}
                className="relative pb-1 text-sm no-underline"
                href={tab.href}
              >
                <span
                  className={
                    isActive
                      ? "font-semibold text-foreground"
                      : "text-foreground-500"
                  }
                >
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                )}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            Ver como cliente
          </Button>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton>
              <Button variant="outline" size="sm">
                Iniciar sesión
              </Button>
            </SignInButton>
          </Show>
        </div>
      </div>
    </header>
  );
}
