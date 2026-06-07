import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

/**
 * Icon-only button that enforces an accessible label.
 *
 * Use this whenever a button's content is a single icon (no visible text).
 * The required `aria-label` prop removes the a11y guesswork — without it
 * screen readers and keyboard users can't tell what the button does.
 *
 * For buttons with visible text, use a regular `<button>`.
 *
 * @example
 *   <IconButton aria-label="Close" onClick={onClose}>
 *     <IconX size={16} />
 *   </IconButton>
 */
export type IconButtonVariant = 'ghost' | 'primary' | 'secondary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
    extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
    /** Required: accessible label read by screen readers. */
    'aria-label': string;
    /** Optional tooltip / hover title. Often the same as aria-label. */
    title?: string;
    /** Visual style. Defaults to 'ghost' (most common for icon buttons). */
    variant?: IconButtonVariant;
    /** Size — affects padding and the contained icon's expected size. */
    size?: IconButtonSize;
    /** The icon content. Pass a Tabler `<IconXxx />` or any ReactNode. */
    children: ReactNode;
}

const VARIANT_STYLES: Record<IconButtonVariant, React.CSSProperties> = {
    ghost: {
        background: 'transparent',
        border: '1px solid transparent',
        color: 'var(--text-secondary)',
    },
    secondary: {
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
    },
    primary: {
        background: 'var(--accent-primary)',
        border: '1px solid var(--accent-primary)',
        color: 'var(--bg-canvas, #fff)',
    },
    danger: {
        background: 'transparent',
        border: '1px solid transparent',
        color: 'var(--error, #dc2626)',
    },
};

const SIZE_STYLES: Record<IconButtonSize, React.CSSProperties> = {
    sm: { padding: '4px', borderRadius: 4 },
    md: { padding: '6px', borderRadius: 6 },
    lg: { padding: '8px', borderRadius: 8 },
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    function IconButton(
        { variant = 'ghost', size = 'md', children, style, disabled, ...rest },
        ref,
    ) {
        return (
            <button
                ref={ref}
                type="button"
                disabled={disabled}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    transition: 'background 120ms ease, color 120ms ease',
                    ...VARIANT_STYLES[variant],
                    ...SIZE_STYLES[size],
                    ...style,
                }}
                {...rest}
            >
                {children}
            </button>
        );
    },
);
