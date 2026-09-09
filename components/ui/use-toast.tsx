import * as React from "react";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from "@/components/ui/toast";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
};

const TOAST_REMOVE_DELAY = 1000;

type ToasterState = {
  toasts: ToasterToast[];
};

const ToastContext = React.createContext<{
  toasts: ToasterToast[];
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return {
      toasts: [],
      toast: () => {},
      dismiss: () => {},
    };
  }
  return {
    toasts: ctx.toasts,
    toast: (props: Omit<ToasterToast, "id">) => {
      const id = Math.random().toString(36).slice(2);
      ctx.dispatch({ type: "ADD_TOAST", toast: { ...props, id } });
    },
    dismiss: (toastId?: string) => ctx.dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "DISMISS_TOAST"; toastId?: string };

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const reducer = (state: ToasterState, action: Action): ToasterState => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, 5),
      };
    case "DISMISS_TOAST":
      if (action.toastId) {
        toastTimeouts.delete(action.toastId);
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
  return state;
};

export function Toaster() {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] });

  React.useEffect(() => {
    state.toasts.forEach((t) => {
      if (!toastTimeouts.has(t.id)) {
        const timeout = setTimeout(() => {
          dispatch({ type: "DISMISS_TOAST", toastId: t.id });
        }, TOAST_REMOVE_DELAY);
        toastTimeouts.set(t.id, timeout);
      }
    });
  }, [state.toasts]);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, dispatch }}>
      {state.toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastContext.Provider>
  );
}