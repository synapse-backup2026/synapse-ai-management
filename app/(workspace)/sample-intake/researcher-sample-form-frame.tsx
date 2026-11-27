'use client';

import {useEffect, useRef} from 'react';

export default function ResearcherSampleFormFrame({referrals = false}: {referrals?: boolean}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const src = referrals ? '/synapse-sample-form.html?mode=referrals' : '/synapse-sample-form.html';

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    let observer: ResizeObserver | undefined;

    function fitForm() {
      observer?.disconnect();
      const content = element?.contentDocument?.querySelector('main');
      if (!content || !element) return;
      const resize = () => {
        element.style.height = `${Math.ceil(content.getBoundingClientRect().height)}px`;
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(content);
    }

    element.addEventListener('load', fitForm);
    fitForm();
    return () => {
      element.removeEventListener('load', fitForm);
      observer?.disconnect();
    };
  }, [src]);

  return <iframe
    ref={frame}
    src={src}
    title="فرم اطلاعات نمونه‌های پژوهشی"
    style={{display: 'block', width: '100%', height: 720, border: 0}}
  />;
}
