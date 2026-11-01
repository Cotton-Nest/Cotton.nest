
import { GoogleGenAI } from "@google/genai";

export type DescriptionStyle =
  | "elegant"
  | "luxurious"
  | "minimal"
  | "detailed"
  | "playful";

export interface GenerateDescriptionPayload {
  name?: string;
  fabric?: string;
  colorTone?: string;
  pattern?: string;
  dimensions?: string;
  threadCount?: string;
  pillowCovers?: string;
  collection?: string;
  features?: string[];
  style?: DescriptionStyle;
  customNotes?: string;
  imageUrl?: string;
}

export interface GenerateDescriptionResponse {
  success: boolean;
  description: string;
  source: "gemini" | "atelier_engine";
  style: string;
  model?: string;
  warnings?: string;
  error?: string;
}

function isKidsProduct(payload: GenerateDescriptionPayload): boolean {
  const text = `${payload.name || ""} ${payload.pattern || ""} ${payload.collection || ""} ${payload.customNotes || ""}`.toLowerCase();

  return (
    payload.style === "playful" ||
    ["kid", "child", "baby", "nursery", "safari", "animal", "dino", "cartoon", "teddy", "cute", "star", "bear", "bunny", "jungle"].some(word => text.includes(word))
  );
}

export function generateAtelierDescription(payload: GenerateDescriptionPayload): string {
  const name = (payload.name || "Bedsheet").trim();
  const fabric = payload.fabric?.trim();
  const threadCount = payload.threadCount?.trim();
  const dimensions = payload.dimensions?.trim();
  const pillowCovers = payload.pillowCovers?.trim();
  const pattern = payload.pattern?.trim();
  const colorTone = payload.colorTone?.trim();
  const collection = payload.collection?.trim();
  const style = payload.style || (isKidsProduct(payload) ? "playful" : "elegant");

  const details = [
    pattern && `featuring ${pattern}`,
    colorTone && `in ${colorTone} tones`,
    fabric && `made with ${fabric}`,
    threadCount && `with ${threadCount}`,
    dimensions && `measuring ${dimensions}`,
    pillowCovers && `including ${pillowCovers}`
  ].filter(Boolean).join(", ");

  const opening = collection
    ? `From the ${collection}, ${name}`
    : name;

  const description = `${opening} brings a distinctive touch to your bedroom${details ? `, ${details}` : ""}.`;

  const endings: Record<string, string> = {
    elegant: "Its thoughtfully coordinated design adds a graceful and inviting feel to your space.",
    luxurious: "A refined choice for creating a beautifully styled bedroom.",
    minimal: "A clean, understated design that complements everyday interiors.",
    detailed: "A considered combination of design and the specifications provided.",
    playful: "A cheerful design that brings personality and charm to the bedroom."
  };

  return `${description} ${endings[style] || endings.elegant}`;
}

async function resolveImageInput(
  imageUrl?: string
): Promise<{ mimeType: string; data: string } | null> {
  if (!imageUrl) return null;

  const maxBytes = 2.8 * 1024 * 1024;

  const dataUrlMatch = imageUrl.match(
    /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i
  );

  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1].toLowerCase();
    const data = dataUrlMatch[2];

    if (Buffer.byteLength(data, "base64") > maxBytes) {
      throw new Error("Product image is too large.");
    }

    return { mimeType, data };
  }

  let parsed: URL;

  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error("Invalid product image URL.");
  }

  const allowedHosts = new Set<string>(["res.cloudinary.com"]);

  if (process.env.APP_URL) {
    try {
      allowedHosts.add(new URL(process.env.APP_URL).hostname);
    } catch {}
  }

  if (process.env.VERCEL_URL) {
    allowedHosts.add(
      process.env.VERCEL_URL.replace(/^https?:\/\//, "").split("/")[0]
    );
  }

  if (
    parsed.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && parsed.hostname === "localhost")
  ) {
    throw new Error("Product image URL must use HTTPS.");
  }

  if (!allowedHosts.has(parsed.hostname) &&
      !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
    throw new Error("Use an image hosted on Cloudinary or Cotton Nest.");
  }

  const response = await fetch(parsed.toString(), {
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Could not retrieve product image: HTTP ${response.status}.`);
  }

  const mimeType = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
    throw new Error("Unsupported image format.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.byteLength > maxBytes) {
    throw new Error("Product image is too large.");
  }

  return {
    mimeType,
    data: bytes.toString("base64")
  };
}

export async function generateProductDescription(
  payload: GenerateDescriptionPayload
): Promise<GenerateDescriptionResponse> {
  const isKids = isKidsProduct(payload);
  const style = payload.style || (isKids ? "playful" : "elegant");
  const apiKey = process.env.GEMINI_API_KEY;

  const name = payload.name?.trim() || "Cotton Nest Bedsheet";

  const styleGuides: Record<string, string> = {
    playful: "Cheerful, whimsical and joyful.",
    elegant: "Graceful, calming, poetic and premium.",
    luxurious: "Refined, sophisticated and luxurious.",
    minimal: "Crisp, contemporary and understated.",
    detailed: "Informative, descriptive and clear."
  };

  const systemInstruction = `
You are a professional textile product copywriter for Cotton Nest,
a premium bedding brand in India.

If an image is supplied, inspect it carefully.

Describe only visible visual details:
- Colours
- Floral or geometric motifs
- Borders
- Patterns
- Arrangement of designs
- Overall visual appearance

Never guess fabric, thread count, dimensions, softness,
certifications or care properties from an image.

Use only specifications explicitly supplied by the product owner.

Never invent product claims.

Write 2 to 4 attractive sentences, approximately 50 to 95 words.

Brand tone: warm, elegant, authentic and premium.

Return only the final product description.
`;

  const userPrompt = `
Product name: ${name}
Collection: ${payload.collection || "Not specified"}
Pattern: ${payload.pattern || "Not specified"}
Colour: ${payload.colorTone || "Not specified"}
Fabric: ${payload.fabric || "Not specified"}
Thread count: ${payload.threadCount || "Not specified"}
Dimensions: ${payload.dimensions || "Not specified"}
Pillow covers: ${payload.pillowCovers || "Not specified"}
Additional features: ${(payload.features || []).join(", ") || "Not specified"}

Writing style: ${styleGuides[style] || styleGuides.elegant}

Additional instructions:
${payload.customNotes || "None"}

Generate a premium Cotton Nest product description.
`;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const imageInput = await resolveImageInput(payload.imageUrl);

      const parts: any[] = [{ text: userPrompt }];

      if (imageInput) {
        parts.unshift({
          inlineData: {
            mimeType: imageInput.mimeType,
            data: imageInput.data
          }
        });
      }

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts
          }
        ],
        config: {
          systemInstruction,
          temperature: 0.75
        }
      });

      const generatedText = response.text?.trim() || "";

      if (generatedText.length > 20) {
        return {
          success: true,
          description: generatedText,
          source: "gemini",
          style,
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
        };
      }

      throw new Error("Gemini returned an empty description.");

    } catch (error: any) {
      console.error("Gemini generation failed:", error);

      throw new Error(
        error?.message || "Gemini description generation failed."
      );
    }
  }

  return {
    success: true,
    description: generateAtelierDescription(payload),
    source: "atelier_engine",
    style,
    warnings: "Gemini API is not configured. This fallback does not analyse product images."
  };
}
