import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Pilcrow,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "min-h-[180px] px-3 py-2 focus:outline-none",
          "[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2",
          "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2",
          "[&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
          "[&_strong]:font-semibold [&_em]:italic",
        ),
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML() && !(value === "" && editor.isEmpty)) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="rounded-md border border-input bg-background min-h-[220px]" />
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background overflow-hidden",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
        title="Paragraph"
      >
        <Pilcrow className="w-4 h-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Cmd/Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Cmd/Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "h-8 w-8 inline-flex items-center justify-center rounded text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}
