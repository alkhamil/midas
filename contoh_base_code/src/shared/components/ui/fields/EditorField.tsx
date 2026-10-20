import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Button from '../Button';

interface EditorFieldProps {
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  className?: string;
  testId?: string;
  'data-testid'?: string;
}

const contentSizeStyles: Record<string, string> = {
  sm: 'min-h-24 px-3 py-2 text-xs',
  md: 'min-h-32 px-4 py-2.5 text-sm',
  lg: 'min-h-40 px-5 py-3 text-base',
};

export default function EditorField({
  value = '',
  onChange,
  size = 'md',
  disabled,
  error,
  className = '',
  testId,
  'data-testid': dataTestId,
}: EditorFieldProps) {
  const resolvedTestId = dataTestId ?? testId;
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const toolbarButtons = [
    {
      label: t('fields.bold'),
      title: t('fields.boldTitle'),
      active: editor?.isActive('bold') ?? false,
      action: () => editor?.chain().focus().toggleBold().run(),
      className: 'font-bold',
    },
    {
      label: t('fields.italic'),
      title: t('fields.italicTitle'),
      active: editor?.isActive('italic') ?? false,
      action: () => editor?.chain().focus().toggleItalic().run(),
      className: 'italic',
    },
    {
      label: t('fields.bulletList'),
      title: t('fields.bulletListTitle'),
      active: editor?.isActive('bulletList') ?? false,
      action: () => editor?.chain().focus().toggleBulletList().run(),
      className: '',
    },
    {
      label: t('fields.orderedList'),
      title: t('fields.orderedListTitle'),
      active: editor?.isActive('orderedList') ?? false,
      action: () => editor?.chain().focus().toggleOrderedList().run(),
      className: '',
    },
    {
      label: t('fields.quote'),
      title: t('fields.quoteTitle'),
      active: editor?.isActive('blockquote') ?? false,
      action: () => editor?.chain().focus().toggleBlockquote().run(),
      className: '',
    },
  ];

  return (
    <div>
      <div
        data-testid={resolvedTestId}
        className={[
          'overflow-hidden rounded-lg border bg-background transition-colors',
          error
            ? 'border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20'
            : 'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
          disabled ? 'cursor-not-allowed bg-muted' : '',
          className,
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
          {toolbarButtons.map(button => (
            <Button
              key={button.title}
              type="button"
              size="sm"
              variant={button.active ? 'primary' : 'secondary'}
              disabled={disabled || !editor}
              onClick={button.action}
              title={button.title}
              className={button.className}
            >
              {button.label}
            </Button>
          ))}
        </div>
        <EditorContent
          editor={editor}
          className={[
            'w-full max-w-none outline-none',
            '[&_.tiptap]:outline-none [&_.tiptap]:focus:outline-none',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
            contentSizeStyles[size],
            disabled ? 'text-muted-foreground' : '',
          ].join(' ')}
        />
      </div>
      {error && (
        <p
          data-testid={resolvedTestId ? `${resolvedTestId}-error` : undefined}
          className="mt-1 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
