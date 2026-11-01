interface JsonLdProps {
  data: Record<string, unknown>
}

// Escape <, > and & so the payload cannot terminate or open markup inside the <script> element.
// The result is still valid JSON, so JSON.parse(textContent) yields the original data.
function serializeForScript(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeForScript(data) }}
    />
  )
}
