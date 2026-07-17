# UI Quality Gate (Mandatory)

After implementation is complete and all code changes have passed compilation/lint/tests, you MUST perform a final UI review before considering the task finished.

## Required Preview

Always start the application and inspect the rendered UI in a browser (using the available browser automation tools if present).

Do not assume the UI is correct only because the code compiles.

Your task is not finished until the visual result has also been reviewed.

---

# UI Review Checklist

Verify the following items.

## Layout

* No overflowing content.
* No unexpected horizontal scrolling.
* Consistent spacing between sections.
* Components are visually aligned.
* Empty space is intentional.
* Cards and containers have consistent width.
* No overlapping elements.
* No clipped text.

---

## Typography

* Clear visual hierarchy.
* Headings are distinguishable from body text.
* Font sizes are readable.
* Line height is comfortable.
* Text alignment is consistent.
* Long text behaves correctly (according to project specification).

---

## Color

* All colors come from design tokens.
* No hardcoded colors.
* Accent colors are used consistently.
* Sufficient contrast between text and background.
* Status colors remain consistent across the application.

---

## Components

Verify every visible component.

Examples:

* Button
* Input
* Select
* Checkbox
* Badge
* Progress Bar
* Modal
* Dialog
* Card
* Empty State
* Loading State

Check:

* consistent sizing
* consistent spacing
* consistent border radius
* hover state
* focus state
* disabled state
* active state

---

## Interaction

Verify that:

* hover feels natural
* click targets are easy to use
* keyboard navigation still works
* focus indicators remain visible
* dialogs open correctly
* dialogs close correctly
* destructive actions remain obvious

---

## Responsive

Verify at minimum:

* Mobile (<640px)
* Desktop

Check:

* no overflow
* no broken layout
* controls remain usable
* touch targets remain appropriate
* forms remain readable

---

## Visual Consistency

The application should feel like one coherent product.

Avoid situations where:

* one card has different spacing
* one button has different radius
* one input has different height
* one section uses another visual language

Consistency is more important than decoration.

---

## Simplicity

Prefer:

* clean layout
* predictable interaction
* readable interface

Avoid:

* excessive shadows
* excessive gradients
* unnecessary animations
* visual clutter
* decorative UI with no functional value

---

# Self Review

Before finishing, inspect the page as a user would.

Ask yourself:

* Is anything visually distracting?
* Is anything difficult to understand?
* Is anything inconsistent?
* Does anything look unfinished?
* Would a first-time user immediately understand this screen?

If the answer is "yes" for any question, improve the UI before finishing.

---

# Completion Rule

Do NOT declare the task complete until:

* implementation is finished
* verification passes
* UI review passes
* responsive review passes
* obvious visual inconsistencies have been corrected

Only after all checks pass may you consider the task completed.
