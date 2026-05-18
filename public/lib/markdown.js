import { marked } from "https://esm.sh/marked@12";

marked.setOptions({
  gfm: true,
  breaks: false,
});

// Minimal sanitizer: strip <script>, on*-attrs, javascript: hrefs.
// Skill content is admin-authored, but we still keep this on principle.
function sanitize(html) {
  const tmp = document.createElement("template");
  tmp.innerHTML = html;
  for (const el of tmp.content.querySelectorAll("script, style, iframe, object, embed")) {
    el.remove();
  }
  for (const el of tmp.content.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if (attr.name === "href" && /^\s*javascript:/i.test(attr.value)) {
        el.setAttribute("href", "#");
      }
    }
  }
  return tmp.innerHTML;
}

export function render(md) {
  return sanitize(marked.parse(md || ""));
}
