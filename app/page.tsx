import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SearchBox from "@/components/search-box";

export default async function Home() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name_ar, slug")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <span className="text-lg font-bold">سوق الزلفي</span>
          <nav className="text-sm text-black/60 dark:text-white/60">
            دليل محلات، أسر منتجة، خدمات، عقار، ومستعمل
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-10">
          <SearchBox />
        </div>

        <h1 className="text-xl font-semibold mb-6">تصفح حسب الفئة</h1>

        {!categories || categories.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه فئات بعد — تأكد إن قاعدة البيانات متصلة وseed.sql مطبّق.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="block rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-6 text-center hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                >
                  {category.name_ar}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
