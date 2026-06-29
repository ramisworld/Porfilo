import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const variantClass: Record<Variant, string> = {
  primary: "porfilo-btn-primary",
  secondary: "porfilo-btn-secondary",
  ghost: "porfilo-btn-ghost",
  destructive: "porfilo-btn-destructive",
};

export const PorfiloButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function PorfiloButton(
  { variant = "primary", className = "", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`porfilo-btn ${variantClass[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
});

export function PorfiloButtonLink({
  href,
  variant = "secondary",
  className = "",
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return (
    <a
      href={href}
      className={`porfilo-btn ${variantClass[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </a>
  );
}
