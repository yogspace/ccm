import { motion, useReducedMotion } from "motion/react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

/** Every picture in src/gallery/ shows up in the fan, sorted by file name. */
const files = import.meta.glob<string>(
  "../gallery/*.{jpg,jpeg,png,webp,avif}",
  { eager: true, query: "?url", import: "default" }
);
const pictures = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
  .map(([, url]) => url);

const CARDS = 5;

/**
 * Example pictures between editor and footer, as cards like the share image
 * (without text). Once scrolled into view they rise from the middle and then
 * fold apart left and right along an arc, like a hand of cards. With fewer
 * pictures than cards they repeat.
 */
const GalleryFan = () => {
  const { t } = useTranslation();
  const still = useReducedMotion();
  // Degrees between neighbouring cards – tighter on small screens.
  const [spread] = useState(() => (window.innerWidth < 640 ? 9 : 12));
  if (pictures.length === 0) return null;
  const middle = (CARDS - 1) / 2;

  return (
    <section aria-label={t("gallery.label")} className="gallery">
      {Array.from({ length: CARDS }, (_, i) => {
        const offset = i - middle;
        const angle = offset * spread;
        return (
          <motion.div
            className="gallery-card"
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
              decoding="async"
              loading="lazy"
              src={pictures[i % pictures.length]}
            />
          </motion.div>
        );
      })}
    </section>
  );
};

export default memo(GalleryFan);
