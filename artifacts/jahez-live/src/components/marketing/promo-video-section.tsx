import { useState } from 'react';
import { ArrowUpLeft, Play } from 'lucide-react';
import { Reveal } from '@/components/marketing/studio-motion';
import { signupUrl } from '@/lib/signup';

export const PROMO_VIDEO_ID = 'RIxHLDqy3RE';
export const PROMO_VIDEO_TITLE = 'إنت بتشرح، والباقي علينا | جاهز Live، أول سنتر أونلاين في مصر';
export const PROMO_VIDEO_POSTER = '/images/promo-video-poster.webp';

/** YouTube loads only after the visitor presses play: the page stays light, and nothing reaches YouTube before that. */
export function PromoVideoSection() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="studio-section promo-video-section" id="video">
      <div className="container-wide">
        <Reveal className="studio-section-head">
          <div>
            <span className="studio-kicker">شاهد الفكرة</span>
            <h2>
              جاهز Live
              <br />
              <span>في أقل من دقيقة ونصف.</span>
            </h2>
          </div>
          <p className="promo-video-lead">ما الذي يتغيّر للمدرس والطالب وولي الأمر، حين تصبح الحصة والواجب والفلوس في مكان واحد.</p>
        </Reveal>
        <Reveal>
          <div className="promo-video-frame">
            {playing ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${PROMO_VIDEO_ID}?autoplay=1&rel=0&playsinline=1`}
                title={PROMO_VIDEO_TITLE}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                data-testid="promo-video-player"
              />
            ) : (
              <button type="button" className="promo-video-play" onClick={() => setPlaying(true)} aria-label="شغّل الفيديو التعريفي، دقيقة و25 ثانية" data-testid="button-promo-video-play">
                <img src={PROMO_VIDEO_POSTER} alt="" width={1280} height={720} loading="lazy" decoding="async" />
                <span className="promo-video-icon" aria-hidden="true">
                  <Play size={44} fill="currentColor" strokeWidth={0} />
                </span>
                <span className="promo-video-time" dir="ltr" aria-hidden="true">
                  1:25
                </span>
              </button>
            )}
          </div>
        </Reveal>
        <div className="promo-video-foot">
          <a href={signupUrl()} className="button-primary studio-button" data-testid="link-promo-video-signup">
            سجّل مجانًا <ArrowUpLeft size={22} />
          </a>
          <span className="promo-video-note">الأسماء والأرقام في الفيديو توضيحية.</span>
        </div>
      </div>
    </section>
  );
}
