"use client";

import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Labeled wrapper for a single editor field. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-zinc-700">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

/** Single-line text input wrapped in a label. */
export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** Multi-line text area wrapped in a label. */
export function TextAreaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** Toggle switch row ("Show on page" / feature on-off). */
export function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
      <div className="flex flex-col gap-0.5">
        <Label className="text-zinc-800">{label}</Label>
        {hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Row of fields for one repeatable list item with a remove button. */
export function ListItemCard({
  children,
  onRemove,
  removeLabel = "Remove item",
}: {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="relative rounded-lg border border-zinc-200 bg-white p-3 pr-2 flex flex-col gap-3">
      {children}
      {onRemove ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-zinc-400 hover:text-red-600"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">{removeLabel}</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Button that appends to a repeatable list. */
export function AddItemButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="w-full border-dashed text-zinc-500"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
