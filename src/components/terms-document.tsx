import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renderiza las condiciones de participación (markdown) con estilos de lectura. */
export function TermsDocument({ markdown }: { markdown: string }) {
  return (
    <div className="prose-terms">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
