import Image from "next/image";
import Link from "next/link";
import { AppNavigation } from "@/components/app-navigation";
import { LogoutButton } from "@/components/logout-button";

function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <Link href="/ventas" className="flex items-center gap-3" aria-label="WALL y Eva, ir a ventas">
      <Image src="/icon.svg" width={compacta ? 42 : 54} height={compacta ? 42 : 54} alt="" className="rounded-2xl shadow-sm" priority />
      <span className="min-w-0">
        <span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-[#7a8a83]">El cuchitril de</span>
        <span className="block truncate text-lg font-extrabold leading-tight tracking-tight text-[#1a3b40]">WALL y Eva</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas min-h-screen">
      <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dce7e1] bg-[#fffefa]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_-22px_#214347] backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:flex md:w-64 md:flex-col md:border-r md:border-t-0 md:pb-0 md:shadow-none">
        <div className="hidden px-6 pt-7 md:block"><Marca /></div>
        <AppNavigation />
        <div className="hidden px-4 pb-6 md:mt-auto md:block">
          <div className="mb-4 rounded-2xl border border-[#e6e8df] bg-[#f7f4e9] p-4 text-xs leading-relaxed text-[#627572]">Tu colección, tus ventas y tus cobros en un solo lugar.</div>
          <LogoutButton />
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#e2e9e3] bg-[#fffefa]/95 px-4 py-3 backdrop-blur md:hidden">
          <Marca compacta />
          <LogoutButton compact />
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:px-8 md:pb-16 md:pt-10 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
