import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success" | "warning" | "info";
}

const alertVariants = cn(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-current",
  "data-[variant=default]:bg-background data-[variant=default]:text-foreground data-[variant=default]:border-border",
  "data-[variant=destructive]:bg-destructive/10 data-[variant=destructive]:text-destructive data-[variant=destructive]:border-destructive/20",
  "data-[variant=success]:bg-green-50 data-[variant=success]:text-green-800 data-[variant=success]:border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  "data-[variant=warning]:bg-yellow-50 data-[variant=warning]:text-yellow-800 data-[variant=warning]:border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  "data-[variant=info]:bg-blue-50 data-[variant=info]:text-blue-800 data-[variant=info]:border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
);

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const icons: Record<string, React.ElementType> = {
      default: Info,
      destructive: XCircle,
      success: CheckCircle2,
      warning: AlertTriangle,
      info: Info,
    };
    const Icon = icons[variant] || Info;
    return (
      <div
        ref={ref}
        data-variant={variant}
        className={cn(alertVariants, className)}
        {...props}
      >
        <Icon className="text-current" />
        <div className="pl-7 [&+div]:mt-2">
          {props.children}
        </div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-muted-foreground [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };