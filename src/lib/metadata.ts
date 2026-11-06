import { useEffect } from "react";

import { absoluteUrl } from "@/lib/site";

type PageMetadata = {
  title: string;
  description?: string;
  canonical?: string;
  image?: string | null;
};

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let element =
    document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }

  element.href = href;
}

export function usePageMetadata({
  title,
  description,
  canonical,
  image,
}: PageMetadata) {
  useEffect(() => {
    document.title = title;

    if (description) {
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:description", description);
      upsertMeta("name", "twitter:description", description);
    }

    upsertMeta("property", "og:title", title);
    upsertMeta("name", "twitter:title", title);

    if (canonical) {
      const url = absoluteUrl(canonical);
      upsertCanonical(url);
      upsertMeta("property", "og:url", url);
    }

    if (image) {
      upsertMeta("property", "og:image", image);
      upsertMeta("name", "twitter:image", image);
      upsertMeta("name", "twitter:card", "summary_large_image");
    }
  }, [title, description, canonical, image]);
}
