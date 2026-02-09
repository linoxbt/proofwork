import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
  onChar?: () => void;
}

export function TypewriterText({ text, speed = 30, className, onComplete, onChar }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const charCountRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    charCountRef.current = 0;
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
        // Fire onChar every 3rd character to avoid excessive audio
        charCountRef.current++;
        if (charCountRef.current % 3 === 0) {
          onChar?.();
        }
      } else {
        clearInterval(interval);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onComplete, onChar]);

  return (
    <span className={cn(className)}>
      {displayed}
      {!done && <span className="animate-pulse">█</span>}
    </span>
  );
}
