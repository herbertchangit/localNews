import { toRichTextHtml } from "./richTextUtils";

export default function RichText({ value, className = "" }: { value: string; className?: string }) {
  return (
    <div
      className={`richTextContent ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: toRichTextHtml(value) }}
    />
  );
}
