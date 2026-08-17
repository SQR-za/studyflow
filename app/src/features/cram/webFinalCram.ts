import type { LessonCodeLanguage } from '../../types'

export type CramPriority = 'very-high' | 'high' | 'final'

export interface CramTableSection {
  type: 'table'
  heading: string
  columns: string[]
  rows: string[][]
  note?: string
  source?: string
}

export interface CramCodeExample {
  type: 'code'
  heading: string
  language: LessonCodeLanguage
  code: string
  prompt: string
  answer: string
  explanation: string
  trap?: string
  source?: string
}

export interface CramListSection {
  type: 'list'
  heading: string
  items: string[]
  source?: string
}

export interface CramCalloutSection {
  type: 'callout'
  tone: 'key' | 'exam' | 'warning'
  heading: string
  text: string
  source?: string
}

export type CramSection = CramTableSection | CramCodeExample | CramListSection | CramCalloutSection

export interface CramPhase {
  id: string
  order: number
  minutes: number
  title: string
  subtitle: string
  priority: CramPriority
  source: string
  sections: CramSection[]
}

export interface CramGuide {
  id: string
  eyebrow: string
  title: string
  summary: string
  totalMinutes: number
  phases: CramPhase[]
  finalChecklist: string[]
}

/**
 * A slide-grounded rescue guide for the CCSW-321 final. English terminology is
 * kept verbatim-style for exam recall, while explanations stay concise Arabic.
 */
export const WEB_FINAL_CRAM_GUIDE: CramGuide = {
  id: 'web-final-last-4-hours',
  eyebrow: 'CCSW 321 · FINAL RESCUE GUIDE',
  title: 'ملخص آخر 4 ساعات قبل الاختبار',
  summary: 'امشي بالترتيب: 60 دقيقة CSS، ثم 80 JavaScript، ثم 65 DOM وValidation، وأخيرًا 35 دقيقة استرجاع واختبار. الأولوية مبنية على كثافة الأمثلة وأنماط الأسئلة في السلايدات، وليست ضمانًا للأسئلة الفعلية.',
  totalMinutes: 240,
  phases: [
    {
      id: 'cram-css',
      order: 1,
      minutes: 60,
      title: 'CSS (2)',
      subtitle: 'Layout · Positioning · Responsive · Grid · Flexbox',
      priority: 'very-high',
      source: 'CSS (2) · Slides 3–50',
      sections: [
        {
          type: 'callout',
          tone: 'exam',
          heading: 'خطة الـ60 دقيقة',
          text: '10 دقائق Box Model وdisplay، 15 positioning وz-index، 10 media queries، 20 Grid/Flexbox، و5 دقائق توقّع النتائج أدناه.',
          source: 'CSS (2) · Slides 3–50',
        },
        {
          type: 'table',
          heading: 'Display modes — table to memorize',
          columns: ['Value', 'English definition / behavior', 'Width & height', 'الأثر'],
          rows: [
            ['block', 'Takes the available width and starts a new line.', 'Can be set', 'عنصر صندوقي يدفع التالي لسطر جديد.'],
            ['inline', 'Uses only the width required by its content.', 'Cannot be set (course answer)', 'يبقى داخل السطر.'],
            ['inline-block', 'Flows inline but accepts box dimensions.', 'Can be set', 'مفيد لصنع أعمدة متجاورة.'],
            ['none', 'Removes the element from page layout.', 'N/A', 'يختفي العنصر ولا يترك مساحة.'],
          ],
          note: 'Box Model order (inside → outside): content → padding → border → margin. افحص دعم أي property من caniuse.com.',
          source: 'CSS (2) · Slides 3–9',
        },
        {
          type: 'table',
          heading: 'Positioning — reference point and flow',
          columns: ['Value', 'Reference point', 'Normal flow', 'Exam clue'],
          rows: [
            ['static', 'Normal document flow', 'Stays in flow', 'Default; offsets and z-index are ignored in the course model.'],
            ['relative', 'Its original position', 'Original space stays reserved', 'top/right/bottom/left move it visually.'],
            ['absolute', 'Nearest positioned ancestor; otherwise initial containing block', 'Removed from flow', 'اجعل الأب position: relative غالبًا.'],
            ['fixed', 'Browser viewport', 'Removed from flow', 'يبقى ثابتًا عند scroll.'],
          ],
          note: 'Course answer when equal z-index: fixed > absolute > relative > static. هذا تبسيط للمحاضرة؛ في CSS الحقيقي تدخل stacking contexts وترتيب المصدر.',
          source: 'CSS (2) · Slides 10–19',
        },
        {
          type: 'table',
          heading: 'Grid vs Flexbox',
          columns: ['Point', 'CSS Grid', 'Flexbox'],
          rows: [
            ['Dimension', 'Two-dimensional: rows + columns', 'One-dimensional: row or column'],
            ['Best use', 'Overall and complex page layout', 'Distribution and alignment of items'],
            ['Container', 'display: grid', 'display: flex'],
            ['Key sizing', 'grid-template-columns, grid-template-rows, fr', 'flex: grow shrink basis'],
            ['Spacing / alignment', 'gap, grid-row, grid-column', 'justify-content (main), align-items (cross)'],
            ['Responsive behavior', 'Tracks share available space', 'wrap moves items to a new line'],
          ],
          note: 'grid-column: 1 / 3 ends at line 3, so it usually spans 2 columns. grid-column: 1 / span 3 covers 3 tracks.',
          source: 'CSS (2) · Slides 34–50',
        },
        {
          type: 'table',
          heading: 'Media queries — fast recall',
          columns: ['Term', 'English definition', 'احفظيها'],
          rows: [
            ['Responsive design', 'A consistent experience across devices and screen sizes.', 'اختبري أحجامًا مختلفة.'],
            ['Mobile-first', 'Design for the smallest screen first, then scale up.', 'غالبًا نضيف min-width للشاشات الأكبر.'],
            ['@media', 'Applies styles only when its media type and condition match.', 'type + condition.'],
            ['Media types', 'all, screen, print, handheld, speech', 'الأكثر شيوعًا screen؛ الطباعة print.'],
            ['Conditions', 'width, height, aspect-ratio, orientation', 'min/max تحدد الحدود.'],
          ],
          note: 'Chrome DevTools Device Toolbar يفحص الأحجام، لكن @media print يحتاج print preview أو emulation.',
          source: 'CSS (2) · Slides 20–29',
        },
        {
          type: 'code',
          heading: 'Predict the media-query result',
          language: 'css',
          code: 'h1 { font-size: 24px; }\n\n@media screen and (min-width: 768px) {\n  h1 { font-size: 36px; }\n}',
          prompt: 'What is the h1 size at 767px, exactly 768px, and in print?',
          answer: '767px → 24px. Exactly 768px → 36px. Print → 24px because the screen condition does not match.',
          explanation: 'min-width شامل للحد نفسه؛ لذلك 768px يفعّل القاعدة. media type جزء من الشرط.',
          source: 'CSS (2) · Slides 22–23',
        },
        {
          type: 'code',
          heading: 'Predict the Grid span',
          language: 'css',
          code: '.grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr 1fr;\n}\n.item { grid-column: 1 / 3; }',
          prompt: 'How many columns does .item occupy?',
          answer: 'Two columns: it starts at grid line 1 and stops before grid line 3.',
          explanation: 'الأرقام تشير إلى grid lines وليست عدد الأعمدة. لثلاثة tracks اكتبي 1 / span 3.',
          trap: '1 / 3 لا تعني ثلاثة أعمدة.',
          source: 'CSS (2) · Slides 39–40',
        },
        {
          type: 'code',
          heading: 'Read the flex shorthand',
          language: 'css',
          code: '.item { flex: 1 1 100px; }',
          prompt: 'What do the three values mean, and what happens when space changes?',
          answer: 'flex-grow: 1; flex-shrink: 1; flex-basis: 100px. Items start at 100px and grow or shrink equally.',
          explanation: 'الترتيب في shorthand هو grow ثم shrink ثم basis.',
          source: 'CSS (2) · Slides 48–49',
        },
        {
          type: 'code',
          heading: 'Find and correct the slide errors',
          language: 'css',
          code: '.grid { grid-template-row: auto auto; }\n.flex { flex-wrap: no-wrap; }\n.ticket img { verticel-align: middle; }',
          prompt: 'Which declarations are invalid or misspelled?',
          answer: 'Use grid-template-rows, nowrap, and vertical-align.',
          explanation: 'التصريح غير الصالح يُهمل. no-wrap قد يبدو كأنه يعمل لأن القيمة الابتدائية أصلًا nowrap.',
          trap: 'احفظي الكلمة الصحيحة، لا الرسم المكتوب في الشريحة.',
          source: 'CSS (2) · Slides 33, 38, 44–47',
        },
        {
          type: 'code',
          heading: 'Why does z-index fail?',
          language: 'css',
          code: '.badge {\n  position: static;\n  z-index: 999;\n}',
          prompt: 'Why might .badge still stay underneath, and what is the course-level fix?',
          answer: 'Static positioning ignores z-index in the course model. Change it to position: relative (or another non-static value) before using z-index.',
          explanation: 'z-index يهم عند تداخل العناصر؛ لا يكفي رفع الرقم مع static.',
          source: 'CSS (2) · Slide 19',
        },
      ],
    },
    {
      id: 'cram-javascript',
      order: 2,
      minutes: 80,
      title: 'JavaScript Fundamentals',
      subtitle: 'Runtime · Types · Scope · Coercion · Functions · Arrays · Errors',
      priority: 'very-high',
      source: 'JavaScript · Slides 4–53',
      sections: [
        {
          type: 'callout',
          tone: 'exam',
          heading: 'خطة الـ80 دقيقة',
          text: '15 دقيقة runtime وscript loading، 20 types/scope، 20 coercion/operators، 15 functions/objects/arrays، و10 دقائق code output.',
          source: 'JavaScript · Slides 4–53',
        },
        {
          type: 'table',
          heading: 'Script loading',
          columns: ['Method', 'English definition', 'الأثر'],
          rows: [
            ['Inline', 'JavaScript inside an HTML event attribute.', 'يخلط behavior مع HTML.'],
            ['Embedded', 'JavaScript inside a script element in the page.', 'داخل ملف HTML نفسه.'],
            ['External', 'JavaScript loaded with script src.', 'أفضل للفصل وإعادة الاستخدام.'],
            ['Head without defer', 'Runs while the document may still be parsing.', 'قد يرجع selector قيمة null.'],
            ['External with defer', 'Downloads without blocking parsing and runs after parsing.', 'استخدمي src + defer، وحمّلي dependencies أولًا.'],
          ],
          source: 'JavaScript · Slides 10–13',
        },
        {
          type: 'table',
          heading: 'var, let, const and typeof',
          columns: ['Item', 'English definition / result', 'Exam trap'],
          rows: [
            ['var', 'Function-scoped binding.', 'يظهر خارج if لكنه لا يخرج من الدالة.'],
            ['let', 'Reassignable block-scoped binding.', 'خارج الأقواس → ReferenceError.'],
            ['const', 'Non-reassignable block-scoped binding.', 'لا تعيدي إسناد binding؛ يمكن تعديل محتوى object/array.'],
            ['typeof 10.5', 'number', 'كل الأعداد number.'],
            ['typeof undefined', 'undefined', 'قيمة لم تُعرّف.'],
            ['typeof null', 'object', 'quirk مشهور.'],
            ['typeof [] / {}', 'object', 'المصفوفة object أيضًا.'],
          ],
          note: 'Falsy values: false, null, undefined, 0, NaN, and the empty string. باقي القيم truthy غالبًا.',
          source: 'JavaScript · Slides 20–27, 31',
        },
        {
          type: 'table',
          heading: 'Coercion and equality — memorize the result',
          columns: ['Expression', 'Result', 'Why'],
          rows: [
            ["'' == 0", 'true', 'Loose equality performs coercion.'],
            ["0 == '0'", 'true', 'String is converted for comparison.'],
            ["0 === '0'", 'false', 'Types differ; no coercion.'],
            ['null == undefined', 'true', 'Special loose-equality relationship.'],
            ['null === undefined', 'false', 'Different types.'],
            ['NaN === NaN', 'false', 'NaN is not equal to itself.'],
          ],
          note: 'Operator order: unary → * / % → + - → comparisons → equality → && → || → ?: → assignment. Prefer === when the type matters.',
          source: 'JavaScript · Slides 31–38',
        },
        {
          type: 'table',
          heading: 'Functions, objects and arrays',
          columns: ['Item', 'English definition / effect', 'Mutates original?'],
          rows: [
            ['Function declaration', 'Named function statement; callable before its textual position.', '—'],
            ['Function expression', 'A function stored in a variable and passed as a value.', '—'],
            ['Arrow function', 'Concise function syntax without its own this.', '—'],
            ['Constructor + new', 'Creates instances and binds this to the new object.', '—'],
            ['push / pop', 'Add/remove at the end.', 'Yes'],
            ['sort / splice', 'Sort or remove/replace items.', 'Yes'],
            ['slice / concat', 'Return a partial or combined new array.', 'No'],
            ['join', 'Returns a string.', 'No'],
            ['indexOf', 'Returns a zero-based index or -1.', 'No'],
          ],
          source: 'JavaScript · Slides 39–49',
        },
        {
          type: 'list',
          heading: 'Global functions — one-line recall',
          items: [
            'prompt(): requests user input. alert(): shows a message. confirm(): returns the user’s OK/Cancel choice.',
            'parseInt() and parseFloat(): parse numeric text. isNaN(): checks whether a value is Not-a-Number.',
            'setTimeout(): runs once after a delay. setInterval(): repeats at a specified interval.',
            'document.write() / document.writeln(): write HTML into the document in the introductory examples.',
          ],
          source: 'JavaScript · Slides 17–19, 41',
        },
        {
          type: 'code',
          heading: 'Predict typeof output',
          language: 'javascript',
          code: 'console.log(typeof 10.5, typeof null, typeof [20, "k"]);',
          prompt: 'What is printed?',
          answer: 'number object object',
          explanation: 'null وarrays يعيدان object مع typeof؛ هذه من أشهر فخاخ الاختبار.',
          source: 'JavaScript · Slides 20–21',
        },
        {
          type: 'code',
          heading: 'Find the scope error',
          language: 'javascript',
          code: 'if (true) {\n  var a = 1;\n  let b = 2;\n}\nconsole.log(a);\nconsole.log(b);',
          prompt: 'What is printed, and where does execution fail?',
          answer: 'It prints 1, then throws ReferenceError at console.log(b).',
          explanation: 'var function-scoped؛ let block-scoped وانتهى عند القوس.',
          source: 'JavaScript · Slides 22–26',
        },
        {
          type: 'code',
          heading: 'Predict equality output',
          language: 'javascript',
          code: 'console.log("" == 0, 0 === "0",\n  null == undefined, NaN === NaN);',
          prompt: 'What four Boolean values are printed?',
          answer: 'true false true false',
          explanation: '== يسمح بالتحويل؛ === لا يحوّل. NaN لا يساوي نفسه.',
          source: 'JavaScript · Slides 32–33',
        },
        {
          type: 'code',
          heading: 'Prefix vs postfix decrement',
          language: 'javascript',
          code: 'let b = 5;\nlet x = --b;\nlet y = b--;\nconsole.log(b, x, y);',
          prompt: 'What is printed?',
          answer: '3 4 4',
          explanation: '--b ينقص ثم يعيد 4؛ b-- يعيد 4 أولًا ثم يجعل b تساوي 3.',
          source: 'JavaScript · Slides 37–38',
        },
        {
          type: 'code',
          heading: 'Trace the array methods',
          language: 'javascript',
          code: 'let a = ["milk", "tea"];\na.push("apple");\nconsole.log(a.pop(), a.length, a.indexOf("milk"));',
          prompt: 'What is printed, and what remains in a?',
          answer: 'apple 2 0; a becomes ["milk", "tea"].',
          explanation: 'pop يعيد العنصر المحذوف. length property بلا أقواس، وindex يبدأ من صفر.',
          trap: 'تعليق slide 49 الذي يجعل milk عند 1 غير صحيح؛ أول index هو 0.',
          source: 'JavaScript · Slides 46–49',
        },
        {
          type: 'code',
          heading: 'Exception flow',
          language: 'javascript',
          code: 'try {\n  throw new Error("x");\n  console.log("after");\n} catch (e) {\n  console.log(e.message);\n}',
          prompt: 'What is printed?',
          answer: 'x only.',
          explanation: 'throw يقفز مباشرة إلى catch؛ السطر after لا ينفذ.',
          trap: 'new Error("x") وحدها تنشئ error object؛ يلزم throw لإطلاقه.',
          source: 'JavaScript · Slides 50–51',
        },
        {
          type: 'code',
          heading: 'Correct three common errors',
          language: 'javascript',
          code: 'const count = items.length();\nconst student = Student("Ali");\nconst obj = { name: "Ali", say: () => this.name };',
          prompt: 'Correct all three lines.',
          answer: 'Use items.length; new Student("Ali"); and say() { return this.name; } when this should refer to obj.',
          explanation: 'length property وليست function، constructor يحتاج new، وarrow لا تملك this خاصًا بها.',
          source: 'JavaScript · Slides 28, 40–45, 46',
        },
        {
          type: 'code',
          heading: 'Student GPA output',
          language: 'javascript',
          code: 'const students = [\n  { name: "Moayad", grades: [85, 90, 75] },\n  { name: "Ali", grades: [70, 80, 90] },\n  { name: "Osama", grades: [80, 75, 85] }\n];',
          prompt: 'What are the three arithmetic averages?',
          answer: 'Moayad → 83.333…; Ali → 80; Osama → 80.',
          explanation: 'لكل طالب: sum / grades.length. لا تستخدمي length().',
          source: 'JavaScript · Slides 52–53',
        },
      ],
    },
    {
      id: 'cram-dom',
      order: 3,
      minutes: 65,
      title: 'JavaScript for Web',
      subtitle: 'DOM · Selectors · Traversal · Events · Validation',
      priority: 'very-high',
      source: 'JavaScript for Web · Slides 3–60',
      sections: [
        {
          type: 'callout',
          tone: 'exam',
          heading: 'خطة الـ65 دقيقة',
          text: '15 دقيقة selectors وreturn types، 15 traversal/manipulation، 15 events، 15 validation، و5 دقائق فخاخ الكود.',
          source: 'JavaScript for Web · Slides 10–55',
        },
        {
          type: 'table',
          heading: 'DOM model — direct definitions',
          columns: ['Question', 'English answer', 'الشرح'],
          rows: [
            ['What is the DOM?', 'A browser-created object-oriented interface that represents HTML as objects.', 'يسمح لـJavaScript بتعديل content وstructure وstyle.'],
            ['What is the tree order?', 'Document → html root → head/body → elements, text, and attributes.', 'Document أعلى الشجرة.'],
            ['How many parents can a node have?', 'Zero or one parent; zero to many children and siblings.', 'العلاقة شجرية وليست عدة آباء.'],
            ['What is the document object?', 'The main connection between JavaScript and the DOM.', 'منه نختار ونتنقل ونعدّل ونربط الأحداث.'],
          ],
          source: 'JavaScript for Web · Slides 3–9',
        },
        {
          type: 'table',
          heading: 'DOM selectors — exact return type',
          columns: ['Method', 'Returns', 'Exam note'],
          rows: [
            ['getElementsByTagName()', 'HTMLCollection', 'مجموعة؛ استخدمي [0] للأول.'],
            ['getElementsByName()', 'NodeList', 'مجموعة حسب name.'],
            ['getElementsByClassName()', 'HTMLCollection', 'مجموعة حسب class.'],
            ['getElementById()', 'Single element or null', 'عنصر واحد؛ لا تضيفي [0].'],
            ['querySelector()', 'First matching element or null', 'يقبل أي CSS selector.'],
            ['querySelectorAll()', 'NodeList', 'كل العناصر المطابقة.'],
          ],
          note: 'HTMLCollection وNodeList ليستا Arrays كاملة. استخدمي Array.from(collection) قبل map بحسب نموذج المقرر.',
          source: 'JavaScript for Web · Slides 10–18',
        },
        {
          type: 'table',
          heading: 'Traversal and manipulation',
          columns: ['Property / method', 'English definition / result', 'الفخ'],
          rows: [
            ['parentNode', 'Returns the parent node.', 'العقدة لها zero or one parent.'],
            ['childNodes / firstChild', 'Includes child nodes and may include text nodes.', 'لا تفترضي أنها elements فقط.'],
            ['previousSibling / nextSibling', 'Moves between sibling nodes.', 'قد تصادفين text node بسبب whitespace.'],
            ['createElement(tag)', 'Creates a detached node.', 'لن يظهر حتى تربطينه بالـDOM.'],
            ['appendChild(node)', 'Links the node at the end.', 'الإضافة تجعل العقدة مرئية.'],
            ['insertBefore(new, sibling)', 'Inserts before a child reference.', 'sibling يجب أن يكون child للأب.'],
            ['parent.removeChild(child)', 'Removes a child from its parent.', 'يمكن oldNode.parentNode.removeChild(oldNode).'],
            ['innerHTML / innerText / value', 'Markup / visible text / form value.', 'اختاري الخاصية حسب نوع المحتوى.'],
            ['style.fontWeight / classList', 'Inline style / class management.', 'CSS hyphenated names become camelCase.'],
          ],
          note: 'Slide 24 تكتب prependChild، لكنها ليست DOM method قياسية؛ استخدمي parent.prepend(newNode).',
          source: 'JavaScript for Web · Slides 19–31',
        },
        {
          type: 'table',
          heading: 'Events — what fires and how to register',
          columns: ['Item', 'English definition', 'احفظيها'],
          rows: [
            ['Event-driven programming', 'Code executes after an event fires.', 'الدالة المستمعة تسمى event handler.'],
            ['submit', 'Fires when a form is submitted.', 'المكان الصحيح لـvalidation.'],
            ['click', 'Fires when an element is clicked.', 'زر أو checkbox.'],
            ['keypress', 'Fires when a keyboard key is pressed.', 'مثال Enter في To-do.'],
            ['focus', 'Fires when an element receives focus.', 'عند الانتقال للحقل.'],
            ['addEventListener(name, handler)', 'Registers a handler reference.', 'اسم الحدث بلا on؛ والدالة بلا ().'],
            ['removeEventListener(name, handler)', 'Removes the same registered reference.', 'مرجع الدالة يجب أن يكون نفسه.'],
          ],
          source: 'JavaScript for Web · Slides 32–40',
        },
        {
          type: 'table',
          heading: 'Six validation families',
          columns: ['Type', 'English definition', 'Example'],
          rows: [
            ['Presence', 'Input is not empty or null.', 'Required name.'],
            ['Data type', 'Input has the expected type.', 'Numeric mobile.'],
            ['Format', 'Input matches a required pattern.', 'Email regex.'],
            ['Range', 'Value lies between allowed limits.', 'Age or price.'],
            ['Length', 'Input meets a length limit.', 'Exactly 9 mobile digits.'],
            ['Whitelist', 'Value belongs to an approved set.', 'Accept only provided radio values.'],
          ],
          note: 'Frontend validation gives immediate feedback but can be bypassed؛ لذلك يجب إعادة التحقق في backend. Inputs تحتاج name كي تُرسل.',
          source: 'JavaScript for Web · Slides 41–55',
        },
        {
          type: 'callout',
          tone: 'warning',
          heading: 'Validation slide mismatch',
          text: 'المتطلب النظري في slide 45 يقول: English letters only وطول 2–100. مثال HTML في slide 46 يسمح letters/digits/spaces ويضع maxlength=25. إذا سأل عن requirement اكتبي الأول؛ وإذا سأل عن سلوك الكود الحرفي فاتبعي pattern وmaxlength المكتوبين.',
          source: 'JavaScript for Web · Slides 45–46',
        },
        {
          type: 'code',
          heading: 'Collection is not an Array',
          language: 'javascript',
          code: 'document.querySelectorAll("input").map(x => x.type);',
          prompt: 'What error is expected in the course model, and how do you fix it?',
          answer: 'TypeError: map is not a function. Use Array.from(document.querySelectorAll("input")).map(x => x.type).',
          explanation: 'querySelectorAll يعيد NodeList؛ حوّليه إلى Array قبل Array-only methods.',
          source: 'JavaScript for Web · Slides 17–18',
        },
        {
          type: 'code',
          heading: 'Detached DOM node',
          language: 'javascript',
          code: 'const p = document.createElement("p");\np.innerText = "Hello";',
          prompt: 'Why is nothing visible on the page?',
          answer: 'The node is detached. Add document.body.appendChild(p).',
          explanation: 'createElement ينشئ العقدة فقط؛ الربط بالـDOM هو الذي يعرضها.',
          source: 'JavaScript for Web · Slides 23–26',
        },
        {
          type: 'code',
          heading: 'innerHTML vs innerText',
          language: 'javascript',
          code: 'p.innerHTML = "<b>Hi</b>";\n// versus\np.innerText = "<b>Hi</b>";',
          prompt: 'What appears in each case?',
          answer: 'innerHTML shows Hi in bold. innerText shows the literal text <b>Hi</b>.',
          explanation: 'الأولى تفسر markup؛ الثانية تتعامل معه كنص.',
          source: 'JavaScript for Web · Slides 25, 28',
        },
        {
          type: 'code',
          heading: 'Fix the event listener',
          language: 'javascript',
          code: 'button.addEventListener("click", addElement());',
          prompt: 'What is wrong?',
          answer: 'addElement runs immediately. Pass the reference: button.addEventListener("click", addElement).',
          explanation: 'الأقواس تنفذ الدالة أثناء التسجيل بدل انتظار click.',
          source: 'JavaScript for Web · Slides 34, 39',
        },
        {
          type: 'code',
          heading: 'Safe way to empty a list',
          language: 'javascript',
          code: 'const count = container.children.length;\nfor (let i = 0; i <= count; i++) {\n  container.removeChild(container.firstChild);\n}',
          prompt: 'Why is the loop unsafe, and what is the robust replacement?',
          answer: 'It runs one extra iteration, and children counts elements while firstChild may be a text node. Use: while (container.firstChild) container.removeChild(container.firstChild);',
          explanation: 'احذفي طالما توجد عقدة؛ لا تثبتي count بينما القائمة تتغير.',
          source: 'JavaScript for Web · Slide 40',
        },
        {
          type: 'code',
          heading: 'Form submit validation flow',
          language: 'javascript',
          code: 'form.addEventListener("submit", (event) => {\n  const email = form.elements.email.value;\n  const about = document.querySelector(\n    "input[name=aboutus]:checked"\n  );\n  const validEmail = /^[a-z0-9]+@[a-z]+\\.[a-z]{2,4}$/i.test(email);\n  if (!validEmail || !about) event.preventDefault();\n});',
          prompt: 'What does preventDefault do, and why use :checked and ^...$?',
          answer: 'It stops invalid submission. :checked selects the chosen radio; anchors require the regex to match the whole email.',
          explanation: 'getElementsByName(...)[0] يقرأ أول radio لا المختار، وregex بلا anchors قد يطابق جزءًا فقط.',
          source: 'JavaScript for Web · Slides 47–55',
        },
        {
          type: 'code',
          heading: 'Mobile and whitelist checks',
          language: 'javascript',
          code: 'const mobileOK = /^[0-9]{9}$/.test(mobile);\nconst allowed = ["Google", "TV", "Friend"];\nconst sourceOK = allowed.includes(source);',
          prompt: 'Which validation families are demonstrated?',
          answer: 'mobileOK performs format, data-type-like numeric, and exact-length validation. sourceOK performs whitelist validation.',
          explanation: 'Whitelist ترفض القيمة المحقونة حتى لو عدّل المستخدم HTML من DevTools.',
          source: 'JavaScript for Web · Slides 42, 45, 51, 54–55',
        },
        {
          type: 'list',
          heading: 'Empty-form output shown in the slides',
          items: [
            'First name is missing.',
            'Email is missing, and Email format is wrong.',
            'Mobile is missing, and Mobile must contain numbers only.',
            'Selection is invalid.',
            'Result: Issues found [6], then event.preventDefault() blocks submission.',
          ],
          source: 'JavaScript for Web · Slides 50–52',
        },
        {
          type: 'list',
          heading: 'Libraries, frameworks and best practices',
          items: [
            'jQuery: DOM traversal/manipulation, events, and AJAX.',
            'Moment.js: date/time parsing and formatting. Lodash: utilities for arrays, objects, and strings.',
            'Angular: full MVC-style framework with two-way binding and dependency injection.',
            'React: declarative component-based UI library. Vue: lightweight reactive component framework.',
            'Separate HTML content, CSS presentation, and JavaScript behavior; prefer external .js files.',
            'Avoid globals, load dependencies in order after the page is ready, and keep functions small and reusable.',
          ],
          source: 'JavaScript for Web · Slides 56–60',
        },
      ],
    },
    {
      id: 'cram-final',
      order: 4,
      minutes: 35,
      title: 'Final Recall & Platform Test',
      subtitle: 'Error radar · Closed-book output · Rapid testing',
      priority: 'final',
      source: 'All three final chapters',
      sections: [
        {
          type: 'callout',
          tone: 'key',
          heading: 'خطة آخر 35 دقيقة',
          text: '10 دقائق اقرئي جدول الأخطاء، 10 دقائق توقّعي الناتج المختلط دون تشغيله، و15 دقيقة افتحي اختبارات StudyFlow السريعة للأقسام الضعيفة. لا تبدئي درسًا جديدًا.',
          source: 'All three final chapters',
        },
        {
          type: 'table',
          heading: 'Error radar — wrong → correct',
          columns: ['Wrong / risky', 'Correct', 'Reason'],
          rows: [
            ['flex-wrap: no-wrap', 'flex-wrap: nowrap', 'The first value is invalid.'],
            ['grid-template-row', 'grid-template-rows', 'The property is plural.'],
            ['verticel-align', 'vertical-align', 'Spelling error; declaration is ignored.'],
            ['row code for a vertical result', 'flex-direction: column', 'The slide 47 heading/result are vertical.'],
            ['@media print for a screen rule', '@media screen', 'print targets printers; screen targets displays.'],
            ['script defer without src', 'script src="app.js" defer', 'defer is for external classic scripts in this course example.'],
            ['items.length()', 'items.length', 'length is a property.'],
            ['Student("Ali")', 'new Student("Ali")', 'Constructor invocation needs new.'],
            ['addEventListener("click", fn())', 'addEventListener("click", fn)', 'Pass a function reference.'],
            ['prependChild(node)', 'prepend(node)', 'prependChild is not a standard DOM method.'],
            ['getElementsByName("aboutus")[0]', 'querySelector("input[name=aboutus]:checked")', 'Choose the selected radio, not the first radio.'],
            ['[a-z]+@[a-z]+\\.[a-z]+', '^...$ with suitable ranges', 'Anchors require a whole-field match.'],
          ],
          source: 'CSS Slides 23, 33, 38, 44–47 · JS Slides 13, 28, 43, 46 · Web JS Slides 24, 34, 51–55',
        },
        {
          type: 'code',
          heading: 'Closed-book mixed output',
          language: 'javascript',
          code: 'let n = 3;\nconst values = [n++, ++n, typeof null];\nconsole.log(values.join(" | "));',
          prompt: 'Predict the exact output before opening the answer.',
          answer: '3 | 5 | object',
          explanation: 'n++ يعيد 3 ثم يصبح 4؛ ++n يجعله 5 ثم يعيده؛ typeof null يساوي object.',
          source: 'JavaScript · Slides 20–21, 37–38, 48',
        },
        {
          type: 'code',
          heading: 'Closed-book DOM output',
          language: 'html',
          code: '<p class="msg">One</p>\n<p class="msg">Two</p>\n<script>\n  const items = document.querySelectorAll(".msg");\n  items[0].innerText = `<b>${items.length}</b>`;\n</script>',
          prompt: 'What does the first paragraph display?',
          answer: 'It displays the literal text <b>2</b>, not bold text.',
          explanation: 'querySelectorAll يعيد عنصرين، وinnerText لا يفسّر HTML markup.',
          source: 'JavaScript for Web · Slides 17, 25, 28',
        },
        {
          type: 'callout',
          tone: 'warning',
          heading: 'قرار آخر 15 دقيقة',
          text: 'ابدئي بفحص سريع للأقسام التي لا تستطيعين شرح جدولها من الذاكرة. إذا كانت النتيجة أقل من 70% راجعي الملخص الخاص بالقسم فقط؛ إذا كانت 80% فأكثر انتقلي لاختبار مختلط ولا تعيدي القراءة السلبية.',
          source: 'StudyFlow review strategy',
        },
      ],
    },
  ],
  finalChecklist: [
    'أستطيع ترتيب Box Model وشرح display الأربعة.',
    'أحدد reference point لكل position وأعرف متى يفشل z-index.',
    'أفرّق Grid ثنائي الأبعاد عن Flexbox أحادي البعد وأقرأ flex shorthand.',
    'أتوقع @media عند الحد نفسه وعند print.',
    'أعرف نتائج typeof null والمصفوفة والقيم falsy.',
    'أفرّق var وlet وconst وأتوقع ReferenceError في block scope.',
    'أحل == مقابل === وprefix مقابل postfix دون تشغيل الكود.',
    'أعرف Array methods التي تعدّل الأصل وتلك التي تعيد قيمة جديدة.',
    'أطابق كل DOM selector مع return type الصحيح.',
    'أعرف create → configure → append، والفرق بين innerHTML وinnerText وvalue.',
    'أمرر function reference إلى addEventListener وأستخدم preventDefault عند الخطأ.',
    'أسترجع أنواع validation الستة وأكتب regex مثبتًا وwhitelist.',
  ],
}
