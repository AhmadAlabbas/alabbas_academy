export function safeEmbed(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:") return null;
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtube-nocookie.com",
      ].includes(u.hostname)
    ) {
      const id =
        u.hostname === "youtu.be"
          ? u.pathname.slice(1)
          : u.pathname.startsWith("/embed/")
            ? u.pathname.split("/")[2]
            : u.searchParams.get("v");
      return id && /^[\w-]{11}$/.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    }
    if (
      ["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(u.hostname)
    ) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id)
        ? `https://player.vimeo.com/video/${id}`
        : null;
    }
    if (
      u.hostname === "iframe.mediadelivery.net" &&
      /^\/embed\/\d+\/[\w-]+$/.test(u.pathname)
    )
      return u.href;
  } catch {}
  return null;
}
