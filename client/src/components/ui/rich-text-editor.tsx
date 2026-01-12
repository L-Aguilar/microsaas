import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  List, 
  ListOrdered 
} from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function RichTextEditor({ 
  content = '', 
  onChange, 
  placeholder = 'Escribe aquí...', 
  className,
  disabled = false 
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
        strike: false, // Disable strike to avoid conflicts with underline
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      BulletList,
      OrderedList,
      ListItem,
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
    },
    editable: !disabled,
  });

  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("border border-border rounded-md focus-within:border-border hover:border-border", className)}>
      {/* Toolbar */}
      <div className="border-b border-border p-2 flex items-center gap-1 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "p-2 h-8 w-8",
            editor.isActive('bold') ? 'bg-accent' : ''
          )}
          disabled={disabled}
        >
          <Bold className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "p-2 h-8 w-8",
            editor.isActive('italic') ? 'bg-accent' : ''
          )}
          disabled={disabled}
        >
          <Italic className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            "p-2 h-8 w-8",
            editor.isActive('underline') ? 'bg-accent' : ''
          )}
          disabled={disabled}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn(
            "p-2 h-8 w-8",
            editor.isActive({ textAlign: 'left' }) ? 'bg-accent' : ''
          )}
          disabled={disabled}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn(
            "p-2 h-8 w-8",
            editor.isActive({ textAlign: 'center' }) ? 'bg-accent' : ''
          )}
          disabled={disabled}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn(
            "p-2 h-8 w-8",
            editor.isActive({ textAlign: 'right' }) ? 'bg-accent' : ''
          )}
          disabled={disabled}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "p-2 h-8 w-8",
            editor.isActive('bulletList') ? 'bg-accent' : ''
          )}
          disabled={disabled}
        >
          <List className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "p-2 h-8 w-8",
            editor.isActive('orderedList') ? 'bg-accent' : ''
          )}
          disabled={disabled}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <EditorContent 
        editor={editor} 
        className="p-4 min-h-[200px] focus-within:outline-none prose prose-sm max-w-none [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:resize-none"
      />
    </div>
  );
}