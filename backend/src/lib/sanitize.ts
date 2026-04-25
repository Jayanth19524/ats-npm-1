import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
    "h1",
    "h2",
    "h3",
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "a",
];

const ALLOWED_ATTRS: Record<string, string[]> = {
    a: ["href", "target", "rel"],
};

export function sanitizeRichText(html: string): string {
    if (!html) return "";
    return sanitizeHtml(html, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: ALLOWED_ATTRS,
        allowedSchemes: ["http", "https", "mailto"],
        transformTags: {
            a: (tagName, attribs) => ({
                tagName,
                attribs: {
                    ...attribs,
                    target: "_blank",
                    rel: "noopener noreferrer",
                },
            }),
        },
    });
}
