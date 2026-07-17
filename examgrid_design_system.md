# ExamGrid Design System

This is the design constitution for ExamGrid. Every implementation sprint must strictly adhere to the rules, tokens, and philosophy defined in this document.

## Product Philosophy
ExamGrid is **not an admin dashboard** or traditional ERP software. It is software used every day by institutes to guide thousands of students. 
Every screen should communicate:
* **Clarity**: Avoid visual noise.
* **Confidence**: Actions are predictable.
* **Focus**: Large whitespace, minimal layout.
* **Low cognitive load**: One primary action per screen.

The UI should feel closer to Apple, Linear, Notion, and Stripe.

---

## 1. Typography
* **Font Family**: Clean, sans-serif (Inter, Roboto, or similar system defaults).
* **Headings**: Strong, high contrast `var(--eg-text-primary)`. Minimal font weights.
* **Body Text**: Readable, softer `var(--eg-text-secondary)`. 
* **Microcopy**: Used sparingly. Small, uppercase, tracking-widest for labels `var(--eg-text-tertiary)`.
* **Alignment**: Left-aligned by default. Centered only for hero/login screens.

## 2. Spacing & Layout
* **Whitespace**: Generous. Use `p-8` or `p-10` for large cards. Avoid cramped containers.
* **Structure**: Maintain one clear centered or clean grid layout. Avoid unnecessary "cards inside cards". 
* **Max Width**: Constrain content to readable widths (`max-w-4xl`, `max-w-md` for forms).

## 3. Radii & Shadows
* **Cards & Containers**: `rounded-[24px]` to `rounded-[32px]`.
* **Inputs & Buttons**: `rounded-xl` (inputs), `rounded-[16px]` (buttons).
* **Shadows**: Use `shadow-[var(--eg-shadow-rest)]`. Hover states should use a slightly deeper shadow `shadow-[0_18px_38px_rgba(0,0,0,0.04)]` or similar subtle elevation.

## 4. Colors
* **Backgrounds**: `bg-[var(--eg-background)]` or `bg-[var(--eg-surface-soft)]`. Never large gradients or glassmorphism.
* **Surfaces**: Pure white `bg-white` for primary content cards.
* **Borders**: Extremely subtle `border-[rgba(0,0,0,0.06)]` or `var(--eg-border)`.
* **Primary Actions**: `bg-[var(--eg-accent)]` with a subtle glow/shadow.
* **Avoid**: Legacy `#14213d`, heavy brown/beige gradients, marketing graphics, and unnecessary colors.

## 5. Components

### Buttons
* Primary CTA: `bg-[var(--eg-accent)]`, `text-white`, `rounded-[16px]`, `min-h-[52px]`.
* Hover: `hover:-translate-y-0.5`, `hover:shadow-[0_18px_38px_rgba(81,71,232,0.30)]`.
* Avoid standard shadcn buttons for primary workflow actions if `CTAButton` is available.

### Forms & Inputs
* **Labels**: Above fields, never use placeholders acting as labels.
* **Inputs**: Consistent height (`py-6`), `rounded-xl`, clear focus state `focus-visible:ring-[var(--eg-accent)]`.
* **Errors**: Helpful, non-alarming text. `var(--eg-danger)`.

### Empty States & Loading
* **Loading**: Buttons enter loading state; inputs remain stable (no layout shift).
* **Empty States**: Soft icons, clear single-sentence explanation, one primary CTA to resolve the state.

## 6. Interaction & Motion
* **Hover**: Very subtle elevation (`-translate-y-1` or `-translate-y-0.5`).
* **Transitions**: Smooth, fast (`duration-200` or `duration-300`).
* **Avoid**: Decorative animations, large bouncy transitions.

## 7. Do's and Don'ts
* **DO**: Reuse the existing student design system.
* **DO**: Make desktop, tablet, and mobile all feel like first-class experiences.
* **DO**: Reduce text. Write short, factual copy.
* **DON'T**: Invent new features or redesign workflows.
* **DON'T**: Touch business logic, backend, routing, or schemas.
* **DON'T**: Redesign multiple unrelated modules together. Work strictly within the bounded sprint.
