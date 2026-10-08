import { motion, useReducedMotion } from "motion/react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAssets } from "../assets";

const CARDS = 5;

/** `CARDS` pictures in random order – a different hand on every load. */
const deal = (pictures: string[]) => {
  const deck = [...pictures];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return Array.from({ length: CARDS }, (_, i) => deck[i % deck.length]);
};

/**
 * Example pictures (public/gallery/) between editor and footer, as cards like
 * the share image (without text). Once scrolled into view they rise from the
 * middle and then fold apart left and right along an arc, like a hand of
 * cards. Always five, drawn at random from all pictures; with fewer they
 * repeat.
 */
const GalleryFan = () => {
  const { t } = useTranslation();
  const still = useReducedMotion();
  // Degrees between neighbouring cards – tighter on small screens.
  const [spread] = useState(() => (window.innerWidth < 640 ? 9 : 12));
  const { gallery } = useAssets();
  const [hand] = useState(() => deal(gallery));
  if (gallery.length === 0) return null;
  const middle = (CARDS - 1) / 2;

  return (
    // Cards like the share image, turning around a point far below them; in
    // card units (--fan-card, editor-app.tsx).
    <section
      aria-label={t("gallery.label")}
      className="relative h-[calc(var(--fan-card)*1.45)] self-stretch"
    >
      {Array.from({ length: CARDS }, (_, i) => {
        const offset = i - middle;
        const angle = offset * spread;
        return (
          <motion.div
            className="absolute top-0 left-[calc(50%-var(--fan-card)/2)] aspect-square w-(--fan-card) origin-[50%_300%] rounded-[1.4rem] border-2 border-white/85 bg-[#2a44ff] p-[calc(var(--fan-card)*0.06)] shadow-[0_1.2rem_2.5rem_rgb(5_10_60/0.35)]"
            initial={still ? false : { y: "70%", rotate: 0, opacity: 0 }}
            key={i}
            style={{ zIndex: CARDS - Math.abs(offset) }}
            transition={{
              duration: 1.4,
              // Rise first, then fan out.
              times: [0, 0.4, 1],
              ease: [0.22, 1, 0.36, 1],
              delay: Math.abs(offset) * 0.05,
            }}
            viewport={{ once: true, amount: 0.3 }}
            whileHover={{ scale: 1.06 }}
            whileInView={
              still
                ? { y: "0%", rotate: angle, opacity: 1 }
                : {
                    y: ["70%", "0%", "0%"],
                    rotate: [0, 0, angle],
                    opacity: [0, 1, 1],
                  }
            }
          >
            <img
              alt=""
              className="block size-full rounded-[0.9rem] bg-white object-cover"
              decoding="async"
              loading="lazy"
              src={hand[i]}
            />
          </motion.div>
        );
      })}
    </section>
  );
};

export default memo(GalleryFan);
