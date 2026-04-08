import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'bg-card-solid border border-border-default rounded-lg',
            'max-h-[90vh] overflow-y-auto',
            'animation-fade-in',
            sizes[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {(title || onClose) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
              {title && <h2 className="text-lg font-semibold text-heading">{title}</h2>}
              {onClose && (
                <button
                  onClick={onClose}
                  className="ml-auto text-muted hover:text-heading transition-colors"
                  aria-label="Chiudi"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          )}
          <div className="px-6 py-4">{children}</div>
          {footer && (
            <div className="px-6 py-4 border-t border-border-default bg-page flex gap-2 justify-end">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isDanger = false,
  isLoading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Annulla
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            Conferma
          </Button>
        </>
      }
    >
      <p className="text-body">{message}</p>
    </Modal>
  );
};
