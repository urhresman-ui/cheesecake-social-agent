/**
 * Bere (samo bere, nič ne objavlja) zadnje objave na pravem Us & Cheesecake
 * Instagram feedu prek Instagram Graph API, da se prompt za nov caption
 * lahko izogne ponavljanju istih tem/besednih zvez. Uporablja isti
 * dolgoživi token kot jarvis-hub (graph.instagram.com, Instagram Login) -
 * potrebuje samo osnovni "instagram_business_basic" scope, ki ga imajo vsi
 * tokeni za ta app že privzeto.
 *
 * Ob kakršni koli napaki (manjkajoč token, Graph API napaka, omrežje) vrne
 * prazen seznam namesto da vrže - ta funkcionalnost je "nice to have", ne
 * sme podreti priprave predloga.
 */
export async function getRecentFeedCaptions(limit = 15): Promise<string[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return [];

  try {
    const url = `https://graph.instagram.com/v21.0/me/media?fields=caption,media_product_type,timestamp&limit=${limit}&access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error("getRecentFeedCaptions: Graph API error", await response.text());
      return [];
    }
    const data = await response.json();
    const items: unknown[] = Array.isArray(data?.data) ? data.data : [];
    return items
      .map((item) => (item as { caption?: unknown }).caption)
      .filter((caption): caption is string => typeof caption === "string" && caption.trim().length > 0);
  } catch (error) {
    console.error("getRecentFeedCaptions failed", error);
    return [];
  }
}
