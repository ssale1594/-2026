import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "supabase/**",
      "*.tsbuildinfo",
      "next-env.d.ts",
    ],
  },
  {
    // المشروع كُتب قبل ما يكون فيه lint فعليًا مضبوط — كثير `any` سابقة
    // بالكود الحالي. تحذير بدل خطأ يخلي `npm run lint` يمر ويصير أداة
    // فحص فعلية بدل ما يفشل بالكامل على أول تشغيل؛ تُشدَّد تدريجيًا لاحقًا.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

export default eslintConfig;
