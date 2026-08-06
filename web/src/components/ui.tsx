import { cn } from "@/lib/utils";
import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45",
        size === "sm" && "h-9 rounded-lg px-3 text-sm",
        size === "md" && "h-11 rounded-[10px] px-4 text-[15px]",
        size === "lg" && "h-12 rounded-[10px] px-5 text-base",
        variant === "primary" &&
          "bg-[var(--brand)] text-white hover:bg-[var(--ga-green-deep)]",
        variant === "secondary" &&
          "border border-[var(--stroke-strong)] bg-white text-[var(--text)] hover:bg-[var(--bg)]",
        variant === "ghost" &&
          "text-[var(--brand-ink)] hover:bg-[var(--brand-soft)]",
        variant === "danger" && "bg-[var(--danger)] text-white hover:opacity-90",
        variant === "gold" &&
          "bg-[var(--accent)] text-[var(--brand-ink)] hover:brightness-95",
        className,
      )}
      {...props}
    />
  );
}

const fieldControl =
  "focus-ring w-full rounded-[10px] border border-[var(--stroke)] bg-white text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--brand)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(fieldControl, "h-11 px-3.5 text-[15px]", className)}
        {...props}
      />
    );
  },
);

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldControl, "min-h-28 px-3.5 py-2.5 text-[15px]", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldControl, "h-11 px-3.5 text-[15px]", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]"
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function StatusDot({
  online,
  label,
}: {
  online: boolean;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          online ? "bg-[var(--ok)]" : "bg-[var(--warn)]",
        )}
      />
      {label ?? (online ? "En ligne" : "Hors ligne")}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-[var(--bg)] text-[var(--muted)]",
        tone === "ok" && "bg-[var(--brand-soft)] text-[var(--ok)]",
        tone === "warn" && "bg-[var(--accent-soft)] text-[var(--warn)]",
        tone === "info" && "bg-[var(--info-soft)] text-[var(--info)]",
      )}
    >
      {children}
    </span>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-sans)] text-[1.75rem] font-semibold leading-tight text-[var(--brand-ink)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
