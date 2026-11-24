import { useEffect, useState } from 'react';

type Category = { id: string; label: string };

let cache: Promise<Category[]> | null = null;

/** Kategorie kontraktów z API — pobierane raz na uruchomienie okna. */
export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    if (!cache) {
      cache = window.overlay.categories().then((result) => {
        if (result.ok) return result.data.categories;
        cache = null;
        return [];
      });
    }
    let alive = true;
    void cache.then((list) => alive && setCategories(list));
    return () => {
      alive = false;
    };
  }, []);
  return categories;
}
