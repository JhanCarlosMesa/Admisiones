import type { FaqItem, Testimonial } from "../types";
import { readList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

export function listAllTestimonials(): Testimonial[] {
  return readList<Testimonial>(STORAGE_KEYS.testimonials);
}

export function listAllFaq(): FaqItem[] {
  return readList<FaqItem>(STORAGE_KEYS.faq);
}

export function searchFaq(query: string, category?: string): FaqItem[] {
  const items = listAllFaq();
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesCategory = !category || category === "Todas" || item.category === category;
    if (!matchesCategory) return false;
    if (!q) return true;
    return (
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q)
    );
  });
}

export function faqCategories(): string[] {
  return ["Todas", ...Array.from(new Set(listAllFaq().map((item) => item.category)))];
}
