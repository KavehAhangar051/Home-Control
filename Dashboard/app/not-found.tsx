import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground select-none font-sans"
    >
      <h1 className="mb-3 text-4xl font-extrabold tracking-widest text-accent3">۴۰۴</h1>
      <h2 className="mb-6 text-lg font-bold text-muted-foreground">صفحه مورد نظر یافت نشد</h2>
      <Link
        href="/"
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "rounded-xl",
        })}
      >
        بازگشت به داشبورد
      </Link>
    </main>
  );
}
