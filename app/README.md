# StudyFlow 2 · Security+

تطبيق React + TypeScript لمنصة StudyFlow، منشور داخل `/studyflow/next/` ومهيأ حاليًا لمحتوى **CompTIA Security+ SY0-701** فقط.

## الأوامر

```bash
pnpm install --frozen-lockfile
pnpm validate:data
pnpm test
pnpm build
pnpm check
```

يُكتب ناتج Vite في `../next`، ويتحقق CI من تطابق الناتج المنشور مع المصدر.

## البنية

- `src/state/` لتحميل المحتوى وإدارة الحالة المحفوظة.
- `src/lib/` للتحقق، التكرار المتباعد، الإحصاءات، التخزين، والمزامنة المشفرة.
- `src/features/` للشاشة الرئيسية، الجلسات، الاختبارات، الملاحظات، الخطة، البحث، والإعدادات.
- `public/security-plus-sy0-701.json` هو حزمة المحتوى العامة الوحيدة.

## عقد التوافق

تظل مفاتيح التقدم والمزامنة القديمة كما هي حتى لا يفقد المستخدم تقدمه. حزمة Security+ تستخدم مفتاح كاش مستقلًا:

- `studyflow-v1`
- `studyflow-set-v1`
- `studyflow-plan-v1`
- `studyflow-pass-v1`
- `studyflow-daily-v1`
- `studyflow-sync-v1`
- `studyflow-content-v1`
- `studyflow-builtin-security-plus-sy0-701-v1`

لا تلتزم ملفات المحتوى الجامعي القديمة بالبناء الحالي، ولا تُنشر داخل `next/`.
