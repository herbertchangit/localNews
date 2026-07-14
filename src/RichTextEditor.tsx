import { useEffect, useRef } from "react";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  RemoveFormatting,
  Underline,
} from "lucide-react";
import { richTextToPlainText, sanitizeRichText, toRichTextHtml } from "./richTextUtils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  minLength: number;
  maxLength?: number;
  compact?: boolean;
};

export default function RichTextEditor({
  value,
  onChange,
  label,
  placeholder,
  minLength,
  maxLength,
  compact = false,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const plainLength = richTextToPlainText(value).length;
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  };

  useEffect(() => {
    if (!editorRef.current || value === lastValue.current) return;
    editorRef.current.innerHTML = toRichTextHtml(value);
    lastValue.current = value;
  }, [value]);

  useEffect(() => {
    document.addEventListener("selectionchange", rememberSelection);
    return () => document.removeEventListener("selectionchange", rememberSelection);
  }, []);

  const emitChange = () => {
    if (!editorRef.current) return;
    const next = sanitizeRichText(editorRef.current.innerHTML);
    lastValue.current = next;
    onChange(next);
  };

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    if (savedRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange.current);
    }
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const addLink = () => {
    const href = window.prompt("Enter a web address", "https://");
    if (href && href !== "https://") runCommand("createLink", href);
  };

  const toolbarButton = (
    title: string,
    icon: React.ReactNode,
    action: () => void,
  ) => (
    <button
      type="button"
      className="richTextTool"
      aria-label={title}
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {icon}
    </button>
  );

  return (
    <div className="richTextEditor">
      <div className="richTextToolbar" role="toolbar" aria-label={`${label} formatting`}>
        {toolbarButton("Paragraph", <Pilcrow size={17} />, () => runCommand("formatBlock", "p"))}
        {toolbarButton("Heading", <Heading2 size={17} />, () => runCommand("formatBlock", "h2"))}
        <span className="richTextToolbarDivider" />
        {toolbarButton("Bold", <Bold size={17} />, () => runCommand("bold"))}
        {toolbarButton("Italic", <Italic size={17} />, () => runCommand("italic"))}
        {toolbarButton("Underline", <Underline size={17} />, () => runCommand("underline"))}
        <span className="richTextToolbarDivider" />
        {toolbarButton("Bulleted list", <List size={17} />, () => runCommand("insertUnorderedList"))}
        {toolbarButton("Numbered list", <ListOrdered size={17} />, () => runCommand("insertOrderedList"))}
        {toolbarButton("Quote", <Quote size={17} />, () => runCommand("formatBlock", "blockquote"))}
        {toolbarButton("Link", <Link2 size={17} />, addLink)}
        {toolbarButton("Clear formatting", <RemoveFormatting size={17} />, () => runCommand("removeFormat"))}
      </div>
      <div
        ref={editorRef}
        className={`richTextEditorSurface${compact ? " richTextEditorSurfaceCompact" : ""}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onSelect={rememberSelection}
      />
      <div className={`richTextCounter${plainLength < minLength ? " richTextCounterInvalid" : ""}`}>
        {plainLength} {maxLength ? `/ ${maxLength}` : "characters"} · minimum {minLength}
      </div>
    </div>
  );
}
