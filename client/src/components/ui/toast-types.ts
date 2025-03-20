import * as React from "react";
import type { ToastProps } from "./toast";

export type ToastActionElement = React.ReactElement;

export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};
