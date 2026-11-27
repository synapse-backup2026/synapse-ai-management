'use client';

import {useEffect, useRef, useState} from 'react';

export default function ResearcherSampleFormFrame() {
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(720);

  useEffect(() => () => observer.current?.disconnect(), []);

  function fitForm() {
    observer.current?.disconnect();
    const content = frame.current?.contentDocument?.querySelector('main');
    if (!content) return;

    const measure = () => setHeight(Math.ceil(content.getBoundingClientRect().height));
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(content);
  }

  return <iframe
    ref={frame}
    src="/synapse-sample-form.html"
    title="فرم اطلاعات نمونه‌های پژوهشی"
    onLoad={fitForm}
    style={{display: 'block', width: '100%', height, border: 0}}
  />;
}
