"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useRef, useState } from "react";
import type { EditorView } from "@tiptap/pm/view";
import { filesFromClipboard } from "@/components/file-drop";
import { createClient } from "@/lib/supabase/client";
import { ARTICLES_BUCKET, articleImageUrl } from "@/lib/articles";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Link as LinkIcon,
  ImagePlus,
  Minus,
} from "lucide-react";

interface ArticleEditorProps {
  value: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-8",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </Button>
  );
}

/** Unggah gambar konten artikel, kembalikan URL publiknya (null bila gagal). */
async function uploadContentImage(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    toast.error("File harus berupa gambar.");
    return null;
  }

  const s = createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) {
    toast.error("Sesi berakhir, silakan login ulang.");
    return null;
  }

  const toastId = toast.loading("Mengunggah gambar...");
  const path = `authors/${user.id}/content/${Date.now()}_${file.name.replace(/\s+/g, "-")}`;
  const { error } = await s.storage.from(ARTICLES_BUCKET).upload(path, file);

  if (error) {
    toast.error("Gagal mengunggah gambar", {
      id: toastId,
      description: error.message,
    });
    return null;
  }

  toast.success("Gambar ditambahkan.", { id: toastId });
  return articleImageUrl(path);
}

/** Sisipkan gambar ke editor pada posisi tertentu (default: posisi kursor). */
async function insertImages(view: EditorView, files: File[], pos?: number) {
  for (const file of files) {
    const src = await uploadContentImage(file);
    if (!src || view.isDestroyed) continue;
    const node = view.state.schema.nodes.image.create({ src });
    const tr =
      pos === undefined
        ? view.state.tr.replaceSelectionWith(node)
        : view.state.tr.insert(Math.min(pos, view.state.doc.content.size), node);
    view.dispatch(tr);
    if (pos !== undefined) pos += node.nodeSize;
  }
}

function Toolbar({ editor }: { editor: Editor }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      const src = await uploadContentImage(file);
      if (src) editor.chain().focus().setImage({ src }).run();
    },
    [editor]
  );

  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Masukkan URL tautan:", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1.5">
      <ToolbarButton
        title="Tebal"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Miring"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Coret"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        title="Daftar Bullet"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Daftar Bernomor"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Kutipan"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Blok Kode"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Garis Pemisah"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        title="Tautan"
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Sisipkan Gambar"
        onClick={() => fileInputRef.current?.click()}
      >
        <ImagePlus className="h-4 w-4" />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function ArticleEditor({ value, onChange }: ArticleEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({
        HTMLAttributes: { class: "rounded-lg" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      Placeholder.configure({
        placeholder: "Tulis isi artikel di sini…",
      }),
    ],
    content: value,
    editorProps: {
      handlePaste: (view, event) => {
        const images = filesFromClipboard(event.clipboardData).filter((f) =>
          f.type.startsWith("image/")
        );
        if (images.length === 0) return false;
        event.preventDefault();
        void insertImages(view, images);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const images = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (images.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(view, images, pos);
        return true;
      },
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[320px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) {
    return (
      <div className="rounded-md border">
        <div className="h-12 border-b bg-muted/40" />
        <div className="min-h-[320px] animate-pulse bg-muted/20" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "relative rounded-md border focus-within:ring-1 focus-within:ring-ring",
          isDragging && "border-primary ring-2 ring-primary/40"
        )}
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepth.current += 1;
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={() => {
          dragDepth.current = 0;
          setIsDragging(false);
        }}
      >
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
        {isDragging && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow">
              <ImagePlus className="h-3.5 w-3.5" />
              Lepaskan gambar di posisi yang diinginkan
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Tips: tarik &amp; lepas gambar ke dalam editor, atau salin gambar/screenshot lalu tekan Ctrl+V.
      </p>
    </div>
  );
}
