"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Database } from "lucide-react";

interface RecentReport {
  id: string;
  type: "Sales" | "Stock";
  filename: string;
  timestamp: string;
  recordCount: number;
  data: any[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);

  useEffect(() => {
    const loadRecent = () => {
      try {
        const stored = localStorage.getItem("kts_recent_reports");
        if (stored) {
          setRecentReports(JSON.parse(stored));
        }
      } catch (e) {
        console.error(e);
      }
    };

    loadRecent();
    window.addEventListener("kts-recent-reports-updated", loadRecent);
    return () => {
      window.removeEventListener("kts-recent-reports-updated", loadRecent);
    };
  }, []);

  const handleReloadReport = (report: RecentReport) => {
    if (report.type === "Sales") {
      sessionStorage.setItem("kts_active_sales_report", JSON.stringify(report));
      router.push("/average-sales");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("kts-report-loaded", { detail: { type: "Sales" } }));
      }, 100);
    } else {
      sessionStorage.setItem("kts_active_stock_report", JSON.stringify(report));
      router.push("/stock-aging");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("kts-report-loaded", { detail: { type: "Stock" } }));
      }, 100);
    }
  };

  const navItems = [
    {
      name: "Average Sales Report",
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
      name: "Stock Aging Report",
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
    <aside className="w-[200px] bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 h-screen sticky top-0 shrink-0">
      <div className="h-16 flex items-center px-4 border-b border-slate-800 bg-slate-950/50">
        <span className="text-lg font-bold tracking-wider bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          KTS Analytics
        </span>
      </div>
      <nav className="px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href === "/average-sales" && pathname === "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
                active
                  ? "bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500 shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100 border-l-4 border-transparent"
              }`}
            >
              {item.icon(active)}
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Recent Reports Section */}
      <div className="flex-1 flex flex-col justify-end px-3 pb-4 overflow-hidden">
        {recentReports.length > 0 && (
          <div className="border-t border-slate-800/80 pt-4 space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
              Recent Reports
            </h4>
            <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
              {recentReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => handleReloadReport(report)}
                  className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800 transition text-[11px] group"
                >
                  {report.type === "Sales" ? (
                    <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-300 truncate group-hover:text-white">
                      {report.type} - {report.timestamp}
                    </p>
                    <p className="text-[9px] text-slate-500 truncate">
                      {report.filename}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-950/20 text-[10px] text-slate-500 text-center">
        v1.0.0
      </div>
    </aside>
  );
}
