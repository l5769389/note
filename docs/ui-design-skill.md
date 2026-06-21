# noteDock UI Design Skill

Use this checklist before changing noteDock UI. The product is a local-first
notes and document tool, so the interface should feel calm, dense, predictable,
and work-focused.

## Source Baseline

- NN/g 10 usability heuristics:
  https://www.nngroup.com/articles/ten-usability-heuristics/
- Ant Design design system:
  https://ant.design/docs/spec/introduce/
- Microsoft Fluent 2:
  https://fluent2.microsoft.design/
- Apple Human Interface Guidelines:
  https://developer.apple.com/design/human-interface-guidelines/
- Material Design 3 foundations:
  https://m3.material.io/foundations

## Practical Rules

1. Always show system status.
   Sync, save, import, login, and destructive actions must have visible success,
   pending, and failure states.

2. Use user language, not implementation language.
   Prefer "工作区已同步" over "Workspace synced"; avoid exposing internal terms
   like workspace ids, revision ids, or device tokens unless the user needs them.

3. Keep controls predictable.
   Use standard buttons, inputs, checkboxes, tabs, menus, and icon buttons. Do
   not invent custom interaction patterns for ordinary actions.

4. Prefer dense operational layouts.
   This app is a productivity tool. Avoid marketing-style hero layouts,
   decorative gradients, large empty cards, and visual effects that reduce
   scanning speed.

5. Reduce memory load.
   Labels stay visible. Current state and available actions should be visible at
   the point where the user needs them.

6. Prevent errors before explaining errors.
   Validate required fields before network requests. Destructive actions need
   clear labels and undo/confirmation where appropriate.

7. Make errors actionable.
   Error messages should say what failed and what to do next. No raw stack traces
   in user-facing UI.

8. Keep visual hierarchy restrained.
   Use subtle borders, spacing, typography, and state color. Avoid overusing
   purple/blue gradients and decorative background shapes.

9. Design for keyboard and accessibility.
   Maintain focus states, readable contrast, and sensible focus order. Icon-only
   controls need accessible labels or tooltips.

10. Favor consistency over novelty.
    Reuse existing component shapes, spacing, radius, and color tokens unless a
    deliberate product-level change is being made.
