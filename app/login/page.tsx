import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/" className="text-lg font-bold">
            سوق الزلفي
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-xl font-semibold mb-2">دخول البائعين</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          نرسل لك رابط دخول على بريدك، بدون كلمة مرور.
        </p>
        <LoginForm />
      </main>
    </div>
  );
}
