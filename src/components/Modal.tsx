import React from 'react';
import { WorkspaceDialog } from './WorkspaceDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  return <WorkspaceDialog open={open} onClose={onClose} title={title} size={size}>{children}</WorkspaceDialog>;
}
