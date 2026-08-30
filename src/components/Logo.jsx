import Link from "next/link";

export default function Logo({ dark = false, className = "" }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
        </svg>
      </span>
      <span
        className={`text-xl font-extrabold tracking-tight ${
          dark ? "text-white" : "text-primary"
        }`}
      >
        Estovia
      </span>
    </Link>
  );
}
