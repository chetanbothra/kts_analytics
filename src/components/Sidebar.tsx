"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Average Sales",
      href: "/average-sales",
      icon: (active: boolean) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className={`h-5 w-5 ${active ? "text-indigo-400" : "text-gray-400 group-hover:text-gray-300"}`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
          />
        </svg>
      ),
    },
    {
      name: "Stock Aging",
      href: "/stock-aging",
      icon: (active: boolean) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className={`h-5 w-5 ${active ? "text-indigo-400" : "text-gray-400 group-hover:text-gray-300"}`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
        <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          KTS Analytics
        </span>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href === "/average-sales" && pathname === "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? "bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500 shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100 border-l-4 border-transparent"
              }`}
            >
              {item.icon(active)}
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-800 bg-slate-950/20 text-xs text-slate-500 text-center">
        v1.0.0
      </div>
    </aside>
  );
}
