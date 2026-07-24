import { toRichTextHtml } from "./richTextUtils";

export default function RichText({ value, className = "", onLinkClick }: { value: string; className?: string; onLinkClick?: (url: string) => boolean | void }) {
  return (
    <div
      className={`richTextContent ${className}`.trim()}
      onClick={onLinkClick ? (event) => {
        const anchor = (event.target as Element).closest("a");
        if (anchor instanceof HTMLAnchorElement && onLinkClick(anchor.href)) event.preventDefault();
      } : undefined}
      dangerouslySetInnerHTML={{ __html: toRichTextHtml(value) }}
    />
  );
}
