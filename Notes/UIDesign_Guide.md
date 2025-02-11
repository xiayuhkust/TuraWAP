# TuraWAP Dark Theme Design Guide

This guide outlines the design principles and specifications for TuraWAP's dark theme UI, inspired by Discord's proven design system.

## Color Palette

### Base Colors
- Background (Main): `#313338` - Primary app background
- Background (Card): `#2B2D31` - Elevated surfaces, dialogs
- Background (Input): `#1E1F22` - Form controls, input fields
- Border: `#393B40` - Subtle boundaries and dividers

### Text Colors
- Text (Primary): `#F2F3F5` - Main content, headings
- Text (Secondary): `#949BA4` - Supporting text, placeholders
- Text (Link): `#5865F2` - Interactive text, links

### Brand Colors
- Primary: `#5865F2` - Discord Blue, main accent color
- Destructive: `#ED4245` - Error states, destructive actions
- Success: `#3BA55C` - Success states, confirmations

## Typography

### Font Stack
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
```

### Text Sizes
- Base: 14px (0.875rem)
- Small: 12px (0.75rem)
- Large: 16px (1rem)
- Heading: 20px (1.25rem)

## Component Styling

### Cards
```css
/* Base */
rounded-lg border border-[#393B40] bg-[#2B2D31] p-4

/* Hover State */
hover:translate-y-[-1px] hover:bg-[#2F3136] hover:border-[#393B40]

/* Transition */
transition-all duration-200
```

### Buttons

#### Primary Button
```css
/* Base */
bg-[#5865F2] text-white rounded-md px-4 py-2

/* Hover */
hover:bg-[#5865F2]/90

/* Focus */
focus-visible:ring-2 focus-visible:ring-[#5865F2]
```

#### Secondary Button
```css
/* Base */
bg-[#1E1F22] text-[#F2F3F5] rounded-md px-4 py-2

/* Hover */
hover:bg-[#2B2D31]
```

#### Outline Button
```css
/* Base */
border border-[#393B40] bg-transparent text-[#F2F3F5]

/* Hover */
hover:bg-[#1E1F22]
```

### Input Fields
```css
/* Base */
bg-[#1E1F22] border border-[#393B40] rounded-md px-3 py-1

/* Focus */
focus-visible:border-[#5865F2] focus-visible:ring-1 focus-visible:ring-[#5865F2]

/* Placeholder */
placeholder:text-[#949BA4]
```

## Interaction Patterns

### Transitions
- Duration: 200ms
- Timing: ease-in-out
- Properties: all (for comprehensive transitions)

### Hover Effects
- Subtle elevation changes (1-2px)
- Slight background color shifts
- Border color enhancements

### Focus States
- Blue ring (#5865F2)
- 1px ring thickness
- No outline
- High contrast for accessibility

## Accessibility Guidelines

### Contrast Ratios
- Text on Background: Minimum 4.5:1
- Large Text on Background: Minimum 3:1
- Interactive Elements: Minimum 3:1

### Focus Indicators
- Visible focus rings on all interactive elements
- High contrast focus states
- No focus ring removal

## Best Practices

1. **Depth and Hierarchy**
   - Use background colors to indicate elevation
   - Darker backgrounds for lower layers
   - Lighter backgrounds for elevated components

2. **Interactive States**
   - Clear hover states for all clickable elements
   - Consistent focus indicators
   - Smooth transitions between states

3. **Typography**
   - Maintain high contrast for readability
   - Use muted colors sparingly
   - Keep text sizes consistent

4. **Component Spacing**
   - Consistent padding within components (16px/1rem)
   - Adequate spacing between components (24px/1.5rem)
   - Maintain breathing room around content

5. **Border Usage**
   - Subtle borders for definition
   - Increased opacity on hover
   - Consistent border radius (8px)

## Implementation Notes

### CSS Variables
```css
--background: 223 7% 21%;     /* #313338 */
--foreground: 220 13% 95%;    /* #F2F3F5 */
--muted: 220 7% 12%;          /* #1E1F22 */
--muted-foreground: 220 9% 61%; /* #949BA4 */
--card: 222 7% 18%;           /* #2B2D31 */
--border: 223 7% 24%;         /* #393B40 */
--primary: 235 86% 65%;       /* #5865F2 */
```

### Tailwind Configuration
- Use HSL color values for consistency
- Extend theme with custom colors
- Maintain semantic color naming

## Adding New Components

When adding new components:

1. **Color Selection**
   - Use semantic color variables
   - Maintain contrast ratios
   - Follow elevation principles

2. **Interaction Design**
   - Implement consistent hover states
   - Add focus indicators
   - Use standard transition timings

3. **Accessibility**
   - Test contrast ratios
   - Ensure keyboard navigation
   - Maintain focus visibility

4. **Consistency**
   - Match existing component patterns
   - Use established spacing
   - Follow typography guidelines

This guide serves as a living document for maintaining consistency in TuraWAP's dark theme implementation. When adding new UI elements, refer to these guidelines to ensure a cohesive user experience.
