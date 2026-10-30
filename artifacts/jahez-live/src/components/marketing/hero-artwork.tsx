import { MessageCircle, Sparkles } from "lucide-react";

export function HeroArtwork() {
  return (
    <div className="hero-artwork">
      <span className="hero-art-star star-one" aria-hidden="true">
        <Sparkles size={37} strokeWidth={1.8} />
      </span>
      <img
        className="hero-art-image"
        src={`${import.meta.env.BASE_URL}images/learning-hero.webp`}
        alt="تصميم توضيحي لمدرس مصري يحمل جهازًا لوحيًا أمام شاشات حصص مباشرة"
        width={1000}
        height={1250}
        fetchPriority="high"
        decoding="async"
      />
      <span className="hero-art-note">
        <MessageCircle size={19} /> اسأل حتى تفهم.
      </span>
      <span className="hero-art-star star-two" aria-hidden="true">
        <Sparkles size={24} strokeWidth={1.8} />
      </span>
    </div>
  );
}
